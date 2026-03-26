const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      default: 'general',
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      default: '',
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    leaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveRequest',
      default: null,
      index: true,
    },
    holidayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Holiday',
      default: null,
      index: true,
    },
    /** Work-TZ calendar day (YYYY-MM-DD) when this holiday-eve reminder was sent (dedup). */
    eveDate: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, holidayId: 1, eveDate: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
