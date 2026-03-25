const Notification = require('../models/Notification');
const LeaveRequest = require('../models/LeaveRequest');

function canUseNotifications(user) {
  return user && (user.role === 'employee' || user.role === 'employer');
}

function mapNotification(n, leaveStatusById) {
  const lid = n.leaveRequestId ? n.leaveRequestId.toString() : null;
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    attendanceId: n.attendanceId,
    leaveRequestId: n.leaveRequestId || null,
    leaveStatus: lid ? leaveStatusById.get(lid) ?? null : null,
    createdAt: n.createdAt,
  };
}

// @route   GET /api/notifications
// @access  Private (employee + employer)
exports.list = async (req, res) => {
  try {
    if (!canUseNotifications(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const leaveIds = notifications.map((n) => n.leaveRequestId).filter(Boolean);
    let leaveStatusById = new Map();
    if (leaveIds.length) {
      const leaves = await LeaveRequest.find({ _id: { $in: leaveIds } })
        .select('status')
        .lean();
      leaveStatusById = new Map(leaves.map((l) => [l._id.toString(), l.status]));
    }

    res.json({
      success: true,
      notifications: notifications.map((n) => mapNotification(n, leaveStatusById)),
    });
  } catch (error) {
    console.error('notifications list error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/notifications/unread-count
// @access  Private (employee + employer)
exports.unreadCount = async (req, res) => {
  try {
    if (!canUseNotifications(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ success: true, count });
  } catch (error) {
    console.error('notifications unreadCount error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   PATCH /api/notifications/:id/read
// @access  Private (employee + employer)
exports.markRead = async (req, res) => {
  try {
    if (!canUseNotifications(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const doc = await Notification.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    doc.read = true;
    await doc.save();

    res.json({ success: true });
  } catch (error) {
    console.error('notifications markRead error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/notifications/read-all
// @access  Private (employee + employer)
exports.markAllRead = async (req, res) => {
  try {
    if (!canUseNotifications(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    await Notification.updateMany({ userId: req.user.id, read: false }, { $set: { read: true } });

    res.json({ success: true });
  } catch (error) {
    console.error('notifications markAllRead error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
