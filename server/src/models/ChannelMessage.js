const mongoose = require('mongoose');

const channelMessageSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
  },
  { timestamps: true }
);

channelMessageSchema.index({ channelId: 1, createdAt: -1 });

module.exports = mongoose.model('ChannelMessage', channelMessageSchema);
