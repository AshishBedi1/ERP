const mongoose = require('mongoose');

const noteFolderSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NoteFolder',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

noteFolderSchema.index({ employerId: 1, parentId: 1 });

module.exports = mongoose.model('NoteFolder', noteFolderSchema);
