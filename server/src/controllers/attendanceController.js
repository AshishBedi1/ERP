const Attendance = require('../models/Attendance');
const { getWorkDateString, getWorkTimezone } = require('../utils/workDate');

function isTestResetEnabled() {
  return process.env.ALLOW_ATTENDANCE_TEST_RESET === 'true';
}

function augmentAttendance(doc) {
  if (!doc) return null;
  const att = doc.toObject ? doc.toObject() : { ...doc };
  const start = att.startedAt ? new Date(att.startedAt).getTime() : null;
  const end = att.endedAt ? new Date(att.endedAt).getTime() : null;
  if (start != null && end != null && end > start) {
    const ms = end - start;
    att.durationMs = ms;
    att.durationMinutes = Math.round(ms / 60000);
    att.durationHours = Math.round((ms / 3600000) * 100) / 100;
  }
  return att;
}

// @route   GET /api/attendance/today
// @desc    Today's attendance for the logged-in employee
// @access  Private (employee)
exports.getToday = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can view attendance.' });
    }

    const workDate = getWorkDateString();

    if (!req.user.employerId) {
      return res.json({
        success: true,
        workDate,
        workTimezone: getWorkTimezone(),
        testResetEnabled: isTestResetEnabled(),
        attendance: null,
        message: 'Your account is not linked to an employer yet.',
      });
    }

    const attendance = await Attendance.findOne({
      employeeId: req.user.id,
      workDate,
    });

    res.json({
      success: true,
      workDate,
      workTimezone: getWorkTimezone(),
      testResetEnabled: isTestResetEnabled(),
      attendance: augmentAttendance(attendance),
    });
  } catch (error) {
    console.error('getToday attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/attendance/check-in
// @desc    Mark present for today; records start time on first click
// @access  Private (employee)
exports.checkIn = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can mark attendance.' });
    }

    if (!req.user.employerId) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not linked to an employer. Contact your employer.',
      });
    }

    const workDate = getWorkDateString();

    const existing = await Attendance.findOne({
      employeeId: req.user.id,
      workDate,
    });

    if (existing) {
      if (existing.endedAt) {
        return res.status(400).json({
          success: false,
          message: 'You already completed attendance for today.',
          workTimezone: getWorkTimezone(),
          attendance: augmentAttendance(existing),
        });
      }
      return res.json({
        success: true,
        alreadyMarked: true,
        workDate,
        workTimezone: getWorkTimezone(),
        attendance: augmentAttendance(existing),
        message: 'You already logged in today.',
      });
    }

    const attendance = await Attendance.create({
      employeeId: req.user.id,
      employerId: req.user.employerId,
      workDate,
      startedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      alreadyMarked: false,
      workDate,
      workTimezone: getWorkTimezone(),
      attendance: augmentAttendance(attendance),
    });
  } catch (error) {
    if (error.code === 11000) {
      const workDate = getWorkDateString();
      const attendance = await Attendance.findOne({
        employeeId: req.user.id,
        workDate,
      });
      return res.json({
        success: true,
        alreadyMarked: true,
        workDate,
        workTimezone: getWorkTimezone(),
        attendance: augmentAttendance(attendance),
        message: 'You already logged in today.',
      });
    }
    console.error('checkIn attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/attendance/check-out
// @desc    Leave / clock out; records end time and stops the work session
// @access  Private (employee)
exports.checkOut = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can log out of attendance.' });
    }

    if (!req.user.employerId) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not linked to an employer.',
      });
    }

    const workDate = getWorkDateString();

    const record = await Attendance.findOne({
      employeeId: req.user.id,
      workDate,
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Log in first before logging out.',
      });
    }

    if (record.endedAt) {
      return res.json({
        success: true,
        alreadyEnded: true,
        workDate,
        workTimezone: getWorkTimezone(),
        attendance: augmentAttendance(record),
        message: 'You already logged out today.',
      });
    }

    record.endedAt = new Date();
    await record.save();

    res.json({
      success: true,
      alreadyEnded: false,
      workDate,
      workTimezone: getWorkTimezone(),
      attendance: augmentAttendance(record),
    });
  } catch (error) {
    console.error('checkOut attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/attendance/reset-today
// @desc    Delete today’s attendance only when ALLOW_ATTENDANCE_TEST_RESET=true (testing)
// @access  Private (employee)
exports.resetTodayTest = async (req, res) => {
  try {
    if (!isTestResetEnabled()) {
      return res.status(403).json({
        success: false,
        message: 'Test reset is disabled. Set ALLOW_ATTENDANCE_TEST_RESET=true on the server to enable.',
      });
    }

    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can reset attendance.' });
    }

    const workDate = getWorkDateString();

    const result = await Attendance.deleteOne({
      employeeId: req.user.id,
      workDate,
    });

    res.json({
      success: true,
      deleted: result.deletedCount > 0,
      workDate,
      attendance: null,
      message:
        result.deletedCount > 0
          ? 'Today’s attendance cleared for testing.'
          : 'No attendance record for today.',
    });
  } catch (error) {
    console.error('resetTodayTest error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
