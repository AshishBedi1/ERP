const mongoose = require('mongoose');
const DirectMessage = require('../models/DirectMessage');
const Channel = require('../models/Channel');
const ChannelMessage = require('../models/ChannelMessage');
const User = require('../models/User');

const MAX_BODY = 8000;
const DEFAULT_LIMIT = 50;

function canChat(user) {
  return user && (user.role === 'employee' || user.role === 'employer');
}

function idStr(id) {
  return id?.toString?.() ?? String(id);
}

function sortedPair(a, b) {
  const sa = idStr(a);
  const sb = idStr(b);
  return sa < sb ? [a, b] : [b, a];
}

/**
 * Build $or filter for a thread (legacy employer/employee rows + new sorted-pair rows).
 */
function threadMatchQuery(orgId, selfId, peerId, selfRole, peerRole) {
  const [lo, hi] = sortedPair(selfId, peerId);
  const parts = [{ organizationId: orgId, participantLow: lo, participantHigh: hi }];

  const employerParty = selfRole === 'employer' ? selfId : peerRole === 'employer' ? peerId : null;
  const employeeParty = selfRole === 'employee' ? selfId : peerRole === 'employee' ? peerId : null;
  if (employerParty && employeeParty) {
    parts.push({ employerId: employerParty, employeeId: employeeParty });
  }

  return { $or: parts };
}

/**
 * Resolve org + peer for messaging. Employees may message employer or coworkers (same employerId).
 */
async function resolvePair(req, withUserId) {
  if (!withUserId || !mongoose.Types.ObjectId.isValid(withUserId)) {
    return { error: 'Invalid user.' };
  }

  const user = req.user;
  const other = await User.findById(withUserId).select('role employerId name email isActive');

  if (!other || !other.isActive) {
    return { error: 'User not found.' };
  }

  if (idStr(other._id) === idStr(user._id)) {
    return { error: 'Cannot message yourself.' };
  }

  let organizationId = null;

  if (user.role === 'employer') {
    if (other.role !== 'employee' || idStr(other.employerId) !== idStr(user._id)) {
      return { error: 'Not authorized to chat with this person.' };
    }
    organizationId = user._id;
  } else if (user.role === 'employee') {
    if (!user.employerId) {
      return { error: 'Not authorized to chat with this person.' };
    }
    organizationId = user.employerId;

    if (other.role === 'employer') {
      if (idStr(other._id) !== idStr(user.employerId)) {
        return { error: 'Not authorized to chat with this person.' };
      }
    } else if (other.role === 'employee') {
      if (idStr(other.employerId) !== idStr(user.employerId)) {
        return { error: 'Not authorized to chat with this person.' };
      }
    } else {
      return { error: 'Not authorized to chat with this person.' };
    }
  } else {
    return { error: 'Not authorized.' };
  }

  return {
    organizationId,
    peer: { id: other._id, name: other.name, email: other.email },
    selfRole: user.role,
    peerRole: other.role,
  };
}

function mapMessage(doc) {
  return {
    id: doc._id,
    senderId: doc.senderId,
    body: doc.body,
    readAt: doc.readAt,
    createdAt: doc.createdAt,
  };
}

async function findMessagesThread(req, pair, limit, before) {
  const base = threadMatchQuery(
    pair.organizationId,
    req.user._id,
    pair.peer.id,
    pair.selfRole,
    pair.peerRole
  );

  let filter = base;
  if (before && mongoose.Types.ObjectId.isValid(before)) {
    const beforeDoc = await DirectMessage.findById(before).select('createdAt').lean();
    if (beforeDoc) {
      filter = {
        $and: [
          base,
          {
            $or: [
              { createdAt: { $lt: beforeDoc.createdAt } },
              { createdAt: beforeDoc.createdAt, _id: { $lt: before } },
            ],
          },
        ],
      };
    }
  }

  const raw = await DirectMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = raw.length > limit;
  const slice = hasMore ? raw.slice(0, limit) : raw;
  return { messages: slice.reverse().map(mapMessage), hasMore };
}

// @route   GET /api/chat/messages
exports.listMessages = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const { withUserId } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), 100);
    const before = req.query.before;

    const pair = await resolvePair(req, withUserId);
    if (pair.error) {
      return res.status(pair.error === 'User not found.' ? 404 : 403).json({ success: false, message: pair.error });
    }

    const { messages, hasMore } = await findMessagesThread(req, pair, limit, before);

    res.json({
      success: true,
      peer: pair.peer,
      messages,
      hasMore,
    });
  } catch (error) {
    console.error('chat listMessages error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

function buildCreatePayload(req, pair, body) {
  const [lo, hi] = sortedPair(req.user._id, pair.peer.id);
  const doc = {
    organizationId: pair.organizationId,
    participantLow: lo,
    participantHigh: hi,
    senderId: req.user._id,
    body,
    readAt: null,
  };

  const employerParty = pair.selfRole === 'employer' ? req.user._id : pair.peerRole === 'employer' ? pair.peer.id : null;
  const employeeParty = pair.selfRole === 'employee' ? req.user._id : pair.peerRole === 'employee' ? pair.peer.id : null;
  if (employerParty && employeeParty) {
    doc.employerId = employerParty;
    doc.employeeId = employeeParty;
  }

  return doc;
}

// @route   POST /api/chat/messages
exports.sendMessage = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const { withUserId, body: text } = req.body;
    const body = typeof text === 'string' ? text.trim() : '';

    if (!body) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }
    if (body.length > MAX_BODY) {
      return res.status(400).json({ success: false, message: `Message is too long (max ${MAX_BODY} characters).` });
    }

    const pair = await resolvePair(req, withUserId);
    if (pair.error) {
      return res.status(pair.error === 'User not found.' ? 404 : 403).json({ success: false, message: pair.error });
    }

    const msg = await DirectMessage.create(buildCreatePayload(req, pair, body));

    res.status(201).json({
      success: true,
      message: mapMessage(msg.toObject()),
    });
  } catch (error) {
    console.error('chat sendMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/chat/read
exports.markRead = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const { withUserId } = req.body;
    const pair = await resolvePair(req, withUserId);
    if (pair.error) {
      return res.status(pair.error === 'User not found.' ? 404 : 403).json({ success: false, message: pair.error });
    }

    const match = threadMatchQuery(
      pair.organizationId,
      req.user._id,
      pair.peer.id,
      pair.selfRole,
      pair.peerRole
    );

    const now = new Date();
    await DirectMessage.updateMany(
      {
        ...match,
        senderId: { $ne: req.user._id },
        readAt: null,
      },
      { $set: { readAt: now } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('chat markRead error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/chat/unread-count
exports.unreadCount = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const user = req.user;

    if (user.role === 'employee') {
      if (!user.employerId) {
        return res.json({ success: true, count: 0 });
      }
      const org = user.employerId;
      const count = await DirectMessage.countDocuments({
        readAt: null,
        senderId: { $ne: user._id },
        $or: [
          { employerId: org, employeeId: user._id },
          { organizationId: org, participantLow: user._id },
          { organizationId: org, participantHigh: user._id },
        ],
      });
      return res.json({ success: true, count });
    }

    const E = user._id;
    const count = await DirectMessage.countDocuments({
      readAt: null,
      senderId: { $ne: E },
      $or: [{ employerId: E }, { organizationId: E, participantLow: E }, { organizationId: E, participantHigh: E }],
    });
    return res.json({ success: true, count });
  } catch (error) {
    console.error('chat unreadCount error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

async function lastMessageAndUnread(orgId, selfId, peerId, selfRole, peerRole) {
  const match = threadMatchQuery(orgId, selfId, peerId, selfRole, peerRole);
  const [last, unread] = await Promise.all([
    DirectMessage.findOne(match).sort({ createdAt: -1 }).lean(),
    DirectMessage.countDocuments({
      ...match,
      senderId: { $ne: selfId },
      readAt: null,
    }),
  ]);
  return {
    lastMessage: last
      ? {
          body: last.body,
          senderId: last.senderId,
          createdAt: last.createdAt,
        }
      : null,
    unread,
  };
}

// @route   GET /api/chat/summary — employer: per employee; employee: employer + coworkers
exports.inboxSummary = async (req, res) => {
  try {
    if (req.user.role === 'employer') {
      const employees = await User.find({ employerId: req.user._id, role: 'employee' })
        .select('name email')
        .sort({ name: 1 })
        .lean();

      const employerId = req.user._id;
      const summaries = await Promise.all(
        employees.map(async (emp) => {
          const { lastMessage, unread } = await lastMessageAndUnread(employerId, employerId, emp._id, 'employer', 'employee');
          return {
            peerId: emp._id,
            name: emp.name,
            email: emp.email,
            kind: 'employee',
            lastMessage,
            unread,
          };
        })
      );

      return res.json({ success: true, conversations: summaries });
    }

    if (req.user.role === 'employee') {
      if (!req.user.employerId) {
        return res.json({ success: true, conversations: [] });
      }

      const orgId = req.user.employerId;
      const employer = await User.findOne({ _id: orgId, role: 'employer' }).select('name email').lean();
      const coworkers = await User.find({
        employerId: orgId,
        role: 'employee',
        _id: { $ne: req.user._id },
      })
        .select('name email')
        .sort({ name: 1 })
        .lean();

      const rows = [];

      if (employer) {
        const { lastMessage, unread } = await lastMessageAndUnread(orgId, req.user._id, employer._id, 'employee', 'employer');
        rows.push({
          peerId: employer._id,
          name: employer.name || 'Employer',
          email: employer.email,
          kind: 'employer',
          subtitle: 'Company',
          lastMessage,
          unread,
        });
      }

      for (const c of coworkers) {
        const { lastMessage, unread } = await lastMessageAndUnread(orgId, req.user._id, c._id, 'employee', 'employee');
        rows.push({
          peerId: c._id,
          name: c.name,
          email: c.email,
          kind: 'coworker',
          subtitle: 'Team',
          lastMessage,
          unread,
        });
      }

      return res.json({ success: true, conversations: rows });
    }

    return res.status(403).json({ success: false, message: 'Not authorized.' });
  } catch (error) {
    console.error('chat inboxSummary error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

function organizationIdForChatUser(user) {
  if (!user) return null;
  if (user.role === 'employer') return user._id;
  if (user.role === 'employee' && user.employerId) return user.employerId;
  return null;
}

async function assertChannelAccess(req, channelId) {
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return { error: 'Invalid channel.' };
  }
  const orgId = organizationIdForChatUser(req.user);
  if (!orgId) {
    return { error: 'Not authorized.' };
  }
  const channel = await Channel.findOne({
    _id: channelId,
    organizationId: orgId,
    memberIds: req.user._id,
  })
    .select('name memberIds organizationId')
    .lean();
  if (!channel) {
    return { error: 'Channel not found.' };
  }
  return { channel };
}

async function validateMemberIdsForOrg(orgId, memberObjectIds) {
  const unique = [...new Set(memberObjectIds.map((id) => idStr(id)))];
  if (unique.length !== memberObjectIds.length) {
    return { ok: false, message: 'Duplicate members.' };
  }
  const users = await User.find({
    _id: { $in: memberObjectIds },
    isActive: true,
    $or: [{ _id: orgId, role: 'employer' }, { employerId: orgId, role: 'employee' }],
  })
    .select('_id')
    .lean();
  if (users.length !== memberObjectIds.length) {
    return { ok: false, message: 'One or more people are not in your organization.' };
  }
  return { ok: true };
}

// @route   GET /api/chat/channels
exports.listChannels = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const orgId = organizationIdForChatUser(req.user);
    if (!orgId) {
      return res.json({ success: true, channels: [] });
    }
    const channels = await Channel.find({
      organizationId: orgId,
      memberIds: req.user._id,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();
    res.json({
      success: true,
      channels: channels.map((c) => ({
        id: c._id,
        name: c.name,
        memberIds: c.memberIds,
        lastMessageAt: c.lastMessageAt,
        lastMessagePreview: c.lastMessagePreview || '',
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('chat listChannels error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/chat/channels
exports.createChannel = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const orgId = organizationIdForChatUser(req.user);
    if (!orgId) {
      return res.status(403).json({ success: false, message: 'Not linked to an organization.' });
    }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) {
      return res.status(400).json({ success: false, message: 'Channel name is required (max 80 characters).' });
    }

    const raw = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const extraIds = raw
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    const memberSet = new Set([idStr(req.user._id), ...extraIds.map(idStr)]);
    const memberIds = [...memberSet].map((s) => new mongoose.Types.ObjectId(s));

    if (memberIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Add at least one other person to the channel.' });
    }

    const valid = await validateMemberIdsForOrg(orgId, memberIds);
    if (!valid.ok) {
      return res.status(400).json({ success: false, message: valid.message });
    }

    const channel = await Channel.create({
      organizationId: orgId,
      name,
      memberIds,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      channel: {
        id: channel._id,
        name: channel.name,
        memberIds: channel.memberIds,
        lastMessageAt: channel.lastMessageAt,
        lastMessagePreview: channel.lastMessagePreview || '',
        createdAt: channel.createdAt,
      },
    });
  } catch (error) {
    console.error('chat createChannel error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/chat/channels/:channelId/messages
exports.listChannelMessages = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const { channelId } = req.params;
    const access = await assertChannelAccess(req, channelId);
    if (access.error) {
      return res.status(access.error === 'Channel not found.' ? 404 : 403).json({ success: false, message: access.error });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), 100);
    const before = req.query.before;

    let filter = { channelId: access.channel._id };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      const beforeDoc = await ChannelMessage.findById(before).select('createdAt').lean();
      if (beforeDoc) {
        filter = {
          $and: [
            { channelId: access.channel._id },
            {
              $or: [
                { createdAt: { $lt: beforeDoc.createdAt } },
                { createdAt: beforeDoc.createdAt, _id: { $lt: before } },
              ],
            },
          ],
        };
      }
    }

    const raw = await ChannelMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = raw.length > limit;
    const slice = hasMore ? raw.slice(0, limit) : raw;
    const messages = slice.reverse().map((m) => ({
      id: m._id,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt,
    }));

    const members = await User.find({ _id: { $in: access.channel.memberIds } })
      .select('name email')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      channel: {
        id: access.channel._id,
        name: access.channel.name,
        members: members.map((u) => ({ id: u._id, name: u.name, email: u.email })),
      },
      messages,
      hasMore,
    });
  } catch (error) {
    console.error('chat listChannelMessages error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/chat/channels/:channelId/messages
exports.sendChannelMessage = async (req, res) => {
  try {
    if (!canChat(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const { channelId } = req.params;
    const access = await assertChannelAccess(req, channelId);
    if (access.error) {
      return res.status(access.error === 'Channel not found.' ? 404 : 403).json({ success: false, message: access.error });
    }

    const text = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!text) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }
    if (text.length > MAX_BODY) {
      return res.status(400).json({ success: false, message: `Message is too long (max ${MAX_BODY} characters).` });
    }

    const msg = await ChannelMessage.create({
      channelId: access.channel._id,
      senderId: req.user._id,
      body: text,
    });

    const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
    await Channel.updateOne(
      { _id: access.channel._id },
      { $set: { lastMessageAt: msg.createdAt, lastMessagePreview: preview } }
    );

    res.status(201).json({
      success: true,
      message: {
        id: msg._id,
        senderId: msg.senderId,
        body: msg.body,
        createdAt: msg.createdAt,
      },
    });
  } catch (error) {
    console.error('chat sendChannelMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
