const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    /** Inclusive calendar days for the requested range (full span). */
    days: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    /** Legacy DB rows may still have "probation"; API only creates sick / casual / earned. */
    leaveType: {
      type: String,
      enum: ['sick', 'casual', 'earned', 'probation'],
      default: 'casual',
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employeeId: 1, startDate: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
