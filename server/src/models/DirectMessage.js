const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema(
  {
    /** Organization = employer's User id */
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    /** Sorted pair — unique thread key with organizationId (peer-to-peer within org) */
    participantLow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    participantHigh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    /** Legacy fields (employer–employee threads); kept for existing data */
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

directMessageSchema.index({ employerId: 1, employeeId: 1, createdAt: -1 });
directMessageSchema.index({ organizationId: 1, participantLow: 1, participantHigh: 1, createdAt: -1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);
