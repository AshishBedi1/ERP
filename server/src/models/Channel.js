const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: '' },
  },
  { timestamps: true }
);

channelSchema.index({ organizationId: 1, memberIds: 1 });
channelSchema.index({ organizationId: 1, updatedAt: -1 });

module.exports = mongoose.model('Channel', channelSchema);
