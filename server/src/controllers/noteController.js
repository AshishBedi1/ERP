const mongoose = require('mongoose');
const NoteFolder = require('../models/NoteFolder');
const CompanyNote = require('../models/CompanyNote');

function resolveEmployerId(user) {
  if (user.role === 'employer') return user._id || user.id;
  return user.employerId;
}

function canAccessNotes(user) {
  return user && (user.role === 'employee' || user.role === 'employer');
}

function mapFolder(f) {
  return {
    id: f._id,
    name: f.name,
    parentId: f.parentId || null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

function mapNote(n) {
  return {
    id: n._id,
    folderId: n.folderId || null,
    title: n.title,
    content: n.content,
    updatedBy: n.updatedBy || null,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

async function assertFolderInOrg(employerId, folderId) {
  if (!folderId) return null;
  const f = await NoteFolder.findOne({ _id: folderId, employerId }).lean();
  if (!f) {
    const err = new Error('Folder not found.');
    err.status = 404;
    throw err;
  }
  return f;
}

/** True if `nodeId` is inside the subtree of `ancestorId` (walking up from nodeId reaches ancestorId). */
async function nodeIsUnderAncestor(employerId, ancestorId, nodeId) {
  if (!ancestorId || !nodeId) return false;
  const target = ancestorId.toString();
  let current = await NoteFolder.findOne({ _id: nodeId, employerId }).select('parentId').lean();
  const seen = new Set();
  while (current) {
    if (current._id.toString() === target) return true;
    if (seen.has(current._id.toString())) break;
    seen.add(current._id.toString());
    if (!current.parentId) return false;
    current = await NoteFolder.findOne({ _id: current.parentId, employerId }).select('parentId').lean();
  }
  return false;
}

// GET /api/notes/folders
exports.listFolders = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.json({ success: true, folders: [] });
    }
    const folders = await NoteFolder.find({ employerId }).sort({ name: 1 }).lean();
    res.json({ success: true, folders: folders.map(mapFolder) });
  } catch (error) {
    console.error('listFolders error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/notes/folders
exports.createFolder = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.status(400).json({ success: false, message: 'No organization linked.' });
    }
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Folder name is required.' });
    }
    let parentId = req.body.parentId || null;
    if (parentId) {
      await assertFolderInOrg(employerId, parentId);
    } else {
      parentId = null;
    }

    const folder = await NoteFolder.create({ employerId, name, parentId });
    res.status(201).json({ success: true, folder: mapFolder(folder.toObject()) });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('createFolder error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/notes/folders/:id
exports.updateFolder = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.status(400).json({ success: false, message: 'No organization linked.' });
    }
    const folder = await NoteFolder.findOne({ _id: req.params.id, employerId });
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
      }
      folder.name = name;
    }

    if (req.body.parentId !== undefined) {
      let parentId = req.body.parentId || null;
      if (parentId) {
        if (parentId.toString() === folder._id.toString()) {
          return res.status(400).json({ success: false, message: 'Folder cannot be its own parent.' });
        }
        await assertFolderInOrg(employerId, parentId);
        const wouldCycle = await nodeIsUnderAncestor(employerId, folder._id, parentId);
        if (wouldCycle) {
          return res.status(400).json({ success: false, message: 'Invalid parent (would create a cycle).' });
        }
      }
      folder.parentId = parentId;
    }

    await folder.save();
    res.json({ success: true, folder: mapFolder(folder.toObject()) });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('updateFolder error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/notes/folders/:id
exports.deleteFolder = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.status(400).json({ success: false, message: 'No organization linked.' });
    }
    const folder = await NoteFolder.findOne({ _id: req.params.id, employerId });
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    const [childFolders, noteCount] = await Promise.all([
      NoteFolder.countDocuments({ employerId, parentId: folder._id }),
      CompanyNote.countDocuments({ employerId, folderId: folder._id }),
    ]);
    if (childFolders > 0 || noteCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Remove or move items inside this folder before deleting it.',
      });
    }

    await NoteFolder.deleteOne({ _id: folder._id });
    res.json({ success: true });
  } catch (error) {
    console.error('deleteFolder error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/notes/documents?folderId=
exports.listDocuments = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.json({ success: true, documents: [] });
    }

    const raw = req.query.folderId;
    let filter;
    if (raw === undefined || raw === '' || raw === 'null') {
      filter = { employerId, $or: [{ folderId: null }, { folderId: { $exists: false } }] };
    } else if (!mongoose.Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ success: false, message: 'Invalid folder id.' });
    } else {
      await assertFolderInOrg(employerId, raw);
      filter = { employerId, folderId: raw };
    }

    const documents = await CompanyNote.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, documents: documents.map(mapNote) });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('listDocuments error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/notes/documents/:id
exports.getDocument = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }
    const doc = await CompanyNote.findOne({ _id: req.params.id, employerId }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }
    res.json({ success: true, document: mapNote(doc) });
  } catch (error) {
    console.error('getDocument error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/notes/documents
exports.createDocument = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.status(400).json({ success: false, message: 'No organization linked.' });
    }
    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    let folderId = req.body.folderId || null;
    if (folderId) {
      await assertFolderInOrg(employerId, folderId);
    } else {
      folderId = null;
    }

    const doc = await CompanyNote.create({
      employerId,
      folderId,
      title,
      content,
      updatedBy: req.user._id,
    });
    res.status(201).json({ success: true, document: mapNote(doc.toObject()) });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('createDocument error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/notes/documents/:id
exports.updateDocument = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.status(400).json({ success: false, message: 'No organization linked.' });
    }
    const doc = await CompanyNote.findOne({ _id: req.params.id, employerId });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
      }
      doc.title = title;
    }
    if (req.body.content !== undefined) {
      doc.content = typeof req.body.content === 'string' ? req.body.content : '';
    }
    if (req.body.folderId !== undefined) {
      let folderId = req.body.folderId || null;
      if (folderId) {
        await assertFolderInOrg(employerId, folderId);
      } else {
        folderId = null;
      }
      doc.folderId = folderId;
    }
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json({ success: true, document: mapNote(doc.toObject()) });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('updateDocument error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/notes/documents/:id
exports.deleteDocument = async (req, res) => {
  try {
    if (!canAccessNotes(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.status(400).json({ success: false, message: 'No organization linked.' });
    }
    const result = await CompanyNote.deleteOne({ _id: req.params.id, employerId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('deleteDocument error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
