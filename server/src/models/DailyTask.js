const mongoose = require('mongoose');

const dailyTaskSchema = new mongoose.Schema(
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
    workDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    /** Single block of text (Slack-style plan); newlines allowed. */
    content: {
      type: String,
      default: '',
      maxlength: 10000,
    },
  },
  { timestamps: true }
);

dailyTaskSchema.index({ employeeId: 1, workDate: 1 }, { unique: true });

module.exports = mongoose.model('DailyTask', dailyTaskSchema);
