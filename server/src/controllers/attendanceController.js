const Attendance = require('../models/Attendance');
const DailyTask = require('../models/DailyTask');
const User = require('../models/User');
const Notification = require('../models/Notification');
const LeaveRequest = require('../models/LeaveRequest');
const { getWorkDateString, getWorkTimezone } = require('../utils/workDate');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymdPartsFromYmdString(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

function isWeekendYmd(ymd) {
  const { y, m, d } = ymdPartsFromYmdString(ymd);
  if (!y || !m || !d) return false;
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 || wd === 6;
}

/** Add each calendar YYYY-MM-DD covered by leave [start, end] that falls inside [firstYmd, lastYmd]. */
function addLeaveDaysInRange(leave, firstYmd, lastYmd, set) {
  const s = new Date(leave.startDate);
  s.setHours(0, 0, 0, 0);
  const e = new Date(leave.endDate);
  e.setHours(0, 0, 0, 0);
  for (let x = new Date(s); x <= e; x.setDate(x.getDate() + 1)) {
    const ymd = `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
    if (ymd >= firstYmd && ymd <= lastYmd) set.add(ymd);
  }
}

function mondayOf(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatYmdFromDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Blue present / red absent / green leave / grey none — same rules as calendar month. */
function computeDayStatus(ymd, todayYmd, presentDays, leaveDays) {
  if (leaveDays.has(ymd)) return 'leave';
  if (presentDays.has(ymd)) return 'present';
  if (isWeekendYmd(ymd)) return 'none';
  if (ymd > todayYmd) return 'none';
  if (ymd === todayYmd) return 'none';
  return 'absent';
}

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

/**
 * Per-day status for one employee for a calendar month (shared by employee + employer views).
 * @param {import('mongoose').Types.ObjectId|string} employeeId
 */
async function computeCalendarMonthForEmployee(employeeId, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const firstYmd = `${year}-${pad2(month)}-01`;
  const lastYmd = `${year}-${pad2(month)}-${pad2(lastDay)}`;

  const todayYmd = getWorkDateString();

  const records = await Attendance.find({
    employeeId,
    workDate: { $gte: firstYmd, $lte: lastYmd },
  }).lean();
  const presentDays = new Set(records.map((r) => r.workDate));

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  const leaves = await LeaveRequest.find({
    employeeId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: endOfMonth },
    endDate: { $gte: startOfMonth },
  }).lean();

  const leaveDays = new Set();
  for (const leave of leaves) {
    addLeaveDaysInRange(leave, firstYmd, lastYmd, leaveDays);
  }

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const ymd = `${year}-${pad2(month)}-${pad2(d)}`;
    days.push({ date: ymd, status: computeDayStatus(ymd, todayYmd, presentDays, leaveDays) });
  }

  return {
    success: true,
    year,
    month,
    workTimezone: getWorkTimezone(),
    todayWorkDate: todayYmd,
    days,
  };
}

// @route   GET /api/attendance/team-today
// @desc    Today's attendance for all employees under this employer
// @access  Private (employer)
exports.getTeamToday = async (req, res) => {
  try {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ success: false, message: 'Only employers can view team attendance.' });
    }

    const workDate = getWorkDateString();

    const employees = await User.find({ employerId: req.user.id, role: 'employee' })
      .select('name email')
      .sort({ name: 1 })
      .lean();

    const records = await Attendance.find({ employerId: req.user.id, workDate }).lean();
    const byEmployeeId = new Map(records.map((r) => [r.employeeId.toString(), r]));

    const taskDocs = await DailyTask.find({ employerId: req.user.id, workDate }).lean();

    function docToPlanText(d) {
      if (!d) return '';
      if (typeof d.content === 'string' && d.content.length > 0) return d.content;
      if (Array.isArray(d.items) && d.items.length) {
        return d.items.map((t) => (t && typeof t.text === 'string' ? t.text : '')).join('\n');
      }
      if (d.tasks?.length) {
        return d.tasks
          .map((t) => (t && typeof t.title === 'string' ? t.title : ''))
          .filter(Boolean)
          .join('\n');
      }
      return typeof d.content === 'string' ? d.content : '';
    }

    const textByEmployeeId = new Map(taskDocs.map((d) => [d.employeeId.toString(), docToPlanText(d)]));

    const team = employees.map((emp) => {
      const raw = byEmployeeId.get(emp._id.toString());
      return {
        employeeId: emp._id,
        name: emp.name,
        email: emp.email,
        attendance: augmentAttendance(raw),
        todayTasks: textByEmployeeId.get(emp._id.toString()) || '',
      };
    });

    res.json({
      success: true,
      workDate,
      workTimezone: getWorkTimezone(),
      team,
    });
  } catch (error) {
    console.error('getTeamToday attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/attendance/calendar?year=2026&month=3
// @desc    Per-day status for a month (present / absent / leave / none) for heatmap UI
// @access  Private (employee)
exports.getCalendarMonth = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can view the attendance calendar.' });
    }

    if (!req.user.employerId) {
      return res.status(400).json({ success: false, message: 'Not linked to an employer.' });
    }

    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Query params year and month (1–12) are required.' });
    }

    const payload = await computeCalendarMonthForEmployee(req.user.id, year, month);
    res.json(payload);
  } catch (error) {
    console.error('getCalendarMonth error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/attendance/team/:employeeId/calendar?year=&month=
// @desc    Same calendar as employee view, for one team member (employer only)
// @access  Private (employer)
exports.getEmployeeCalendarForEmployer = async (req, res) => {
  try {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ success: false, message: 'Only employers can view employee calendars.' });
    }

    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Query params year and month (1–12) are required.' });
    }

    const employee = await User.findOne({
      _id: req.params.employeeId,
      employerId: req.user.id,
      role: 'employee',
    })
      .select('name')
      .lean();

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const payload = await computeCalendarMonthForEmployee(employee._id, year, month);
    res.json({
      ...payload,
      employeeId: employee._id,
      employeeName: employee.name,
    });
  } catch (error) {
    console.error('getEmployeeCalendarForEmployer error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/attendance/heatmap?weeks=12
// @desc    LeetCode-style grid: full weeks from (weeks-1) Mondays ago through Sunday of current week
// @access  Private (employee)
exports.getHeatmapWeeks = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can view the heatmap.' });
    }

    if (!req.user.employerId) {
      return res.status(400).json({ success: false, message: 'Not linked to an employer.' });
    }

    const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 12, 1), 52);
    const todayYmd = getWorkDateString();
    const [ty, tm, td] = todayYmd.split('-').map(Number);
    const today = new Date(ty, tm - 1, td);

    const thisMonday = mondayOf(today);
    const gridStart = new Date(thisMonday);
    gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);

    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisSunday.getDate() + 6);

    const firstYmd = formatYmdFromDate(gridStart);
    const lastYmd = formatYmdFromDate(thisSunday);

    const records = await Attendance.find({
      employeeId: req.user.id,
      workDate: { $gte: firstYmd, $lte: lastYmd },
    }).lean();
    const presentDays = new Set(records.map((r) => r.workDate));

    const leaves = await LeaveRequest.find({
      employeeId: req.user.id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: new Date(thisSunday.getFullYear(), thisSunday.getMonth(), thisSunday.getDate(), 23, 59, 59, 999) },
      endDate: { $gte: gridStart },
    }).lean();

    const leaveDays = new Set();
    for (const leave of leaves) {
      addLeaveDaysInRange(leave, firstYmd, lastYmd, leaveDays);
    }

    const cells = [];
    for (let x = new Date(gridStart); x <= thisSunday; x.setDate(x.getDate() + 1)) {
      const ymd = formatYmdFromDate(x);
      if (ymd > todayYmd) {
        cells.push({ date: ymd, status: 'none', isFuture: true });
      } else {
        cells.push({
          date: ymd,
          status: computeDayStatus(ymd, todayYmd, presentDays, leaveDays),
          isFuture: false,
        });
      }
    }

    res.json({
      success: true,
      weeks,
      workTimezone: getWorkTimezone(),
      todayWorkDate: todayYmd,
      startDate: firstYmd,
      endDate: lastYmd,
      cells,
    });
  } catch (error) {
    console.error('getHeatmapWeeks error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

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

// @route   PATCH /api/employer/attendance/:id
// @desc    Employer corrects login/logout times; notifies employee
// @access  Private (employer)
exports.updateByEmployer = async (req, res) => {
  try {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ success: false, message: 'Only employers can update team attendance.' });
    }

    const { id } = req.params;
    const { startedAt, endedAt } = req.body;

    const record = await Attendance.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    if (record.employerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your organization.' });
    }

    const member = await User.findOne({
      _id: record.employeeId,
      employerId: req.user.id,
      role: 'employee',
    });
    if (!member) {
      return res.status(403).json({ success: false, message: 'Employee not found.' });
    }

    if (startedAt !== undefined) {
      const d = new Date(startedAt);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid login time.' });
      }
      record.startedAt = d;
    }

    if (endedAt !== undefined) {
      if (endedAt === null || endedAt === '') {
        record.endedAt = null;
      } else {
        const d = new Date(endedAt);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid logout time.' });
        }
        record.endedAt = d;
      }
    }

    if (record.endedAt && record.startedAt && record.endedAt < record.startedAt) {
      return res.status(400).json({ success: false, message: 'Logout time must be on or after login time.' });
    }

    await record.save();
    const refreshed = await Attendance.findById(record._id);

    await Notification.create({
      userId: record.employeeId,
      type: 'attendance_updated',
      title: 'Attendance updated',
      body: `Your attendance for ${record.workDate} was updated by your employer.`,
      read: false,
      attendanceId: record._id,
    });

    res.json({
      success: true,
      attendance: augmentAttendance(refreshed),
    });
  } catch (error) {
    console.error('updateByEmployerAttendance error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
