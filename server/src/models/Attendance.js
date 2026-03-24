const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
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
    /** YYYY-MM-DD in WORK_TIMEZONE */
    workDate: {
      type: String,
      required: true,
      trim: true,
    },
    /** Server time when employee clicked Present */
    startedAt: {
      type: Date,
      required: true,
    },
    /** Server time when employee clicked Leave (clock out) */
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, workDate: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
