const mongoose = require('mongoose');
const DailyTask = require('../models/DailyTask');
const User = require('../models/User');
const {
  getWorkDateString,
  getWorkTimezone,
  addOneCalendarDay,
  subtractCalendarDays,
} = require('../utils/workDate');

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function countDaysInclusive(fromYmd, toYmd) {
  if (fromYmd > toYmd) return 0;
  let n = 0;
  let cur = fromYmd;
  while (true) {
    n += 1;
    if (cur === toYmd) return n;
    if (n > 400) return 0;
    cur = addOneCalendarDay(cur);
  }
}

/** @returns {{ ok: true, from: string, to: string } | { ok: false, status: number, message: string }} */
function resolveHistoryRange(req) {
  const today = getWorkDateString();
  let from = req.query.from;
  let to = req.query.to;

  if (from && !YMD.test(from)) {
    return { ok: false, status: 400, message: 'Invalid from date (use YYYY-MM-DD).' };
  }
  if (to && !YMD.test(to)) {
    return { ok: false, status: 400, message: 'Invalid to date (use YYYY-MM-DD).' };
  }

  if (!to && !from) {
    to = today;
    from = subtractCalendarDays(today, 89);
  } else if (!to) {
    to = today;
  } else if (!from) {
    from = subtractCalendarDays(to, 89);
  }

  if (from > to) {
    return { ok: false, status: 400, message: 'from must be before or equal to to.' };
  }

  const span = countDaysInclusive(from, to);
  if (span > 366) {
    return { ok: false, status: 400, message: 'Date range must be at most 366 days.' };
  }

  return { ok: true, from, to };
}

const MAX_CONTENT = 10000;

/** Merge legacy shapes (items[], old tasks[], content) into one string. */
function resolveContent(doc) {
  if (!doc) return '';
  if (typeof doc.content === 'string' && doc.content.length > 0) return doc.content;
  if (Array.isArray(doc.items) && doc.items.length) {
    return doc.items
      .map((t) => (t && typeof t.text === 'string' ? t.text : ''))
      .join('\n');
  }
  if (doc.tasks?.length) {
    return doc.tasks
      .map((t) => (t && typeof t.title === 'string' ? t.title : ''))
      .filter(Boolean)
      .join('\n');
  }
  return typeof doc.content === 'string' ? doc.content : '';
}

// @route   GET /api/tasks/today
// @access  Private (employee)
exports.getMyTodayTasks = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can view tasks.' });
    }

    const workDate = getWorkDateString();

    if (!req.user.employerId) {
      return res.json({
        success: true,
        workDate,
        content: '',
        message: 'Your account is not linked to an employer yet.',
      });
    }

    const doc = await DailyTask.findOne({ employeeId: req.user.id, workDate }).lean();
    res.json({ success: true, workDate, content: resolveContent(doc) });
  } catch (error) {
    console.error('getMyTodayTasks error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   PUT /api/tasks/today
// @access  Private (employee)
exports.putMyTodayTasks = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can update tasks.' });
    }

    const employerId = req.user.employerId;
    if (!employerId) {
      return res.status(400).json({ success: false, message: 'Not linked to an employer.' });
    }

    const raw = req.body.content;
    if (raw !== undefined && raw !== null && typeof raw !== 'string') {
      return res.status(400).json({ success: false, message: 'content must be a string.' });
    }

    const content = typeof raw === 'string' ? raw : '';
    if (content.length > MAX_CONTENT) {
      return res.status(400).json({ success: false, message: `Text must be at most ${MAX_CONTENT} characters.` });
    }

    const workDate = getWorkDateString();

    const doc = await DailyTask.findOneAndUpdate(
      { employeeId: req.user.id, workDate },
      {
        $set: {
          employerId,
          content,
        },
        $unset: { items: '', tasks: '' },
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, workDate, content: resolveContent(doc) });
  } catch (error) {
    console.error('putMyTodayTasks error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/tasks/history?from=&to=  (YYYY-MM-DD; optional — default last 90 days through today)
// @access  Private (employee)
exports.getMyTaskHistory = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can view task history.' });
    }

    const range = resolveHistoryRange(req);
    if (!range.ok) {
      return res.status(range.status).json({ success: false, message: range.message });
    }
    const { from, to } = range;

    if (!req.user.employerId) {
      return res.json({
        success: true,
        from,
        to,
        workTimezone: getWorkTimezone(),
        items: [],
      });
    }

    const docs = await DailyTask.find({
      employeeId: req.user.id,
      workDate: { $gte: from, $lte: to },
    })
      .sort({ workDate: -1 })
      .lean();

    const items = docs
      .map((doc) => ({
        workDate: doc.workDate,
        content: resolveContent(doc),
        updatedAt: doc.updatedAt || doc.createdAt,
      }))
      .filter((item) => item.content.trim().length > 0);

    res.json({
      success: true,
      from,
      to,
      workTimezone: getWorkTimezone(),
      items,
    });
  } catch (error) {
    console.error('getMyTaskHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/employer/tasks/history?from=&to=&employeeId=
// @access  Private (employer)
exports.getEmployerTeamTaskHistory = async (req, res) => {
  try {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ success: false, message: 'Only employers can view team task history.' });
    }

    const range = resolveHistoryRange(req);
    if (!range.ok) {
      return res.status(range.status).json({ success: false, message: range.message });
    }
    const { from, to } = range;

    let employeeFilter = null;
    if (req.query.employeeId) {
      const raw = String(req.query.employeeId).trim();
      if (!mongoose.Types.ObjectId.isValid(raw)) {
        return res.status(400).json({ success: false, message: 'Invalid employee id.' });
      }
      const emp = await User.findOne({
        _id: raw,
        employerId: req.user.id,
        role: 'employee',
      })
        .select('_id')
        .lean();
      if (!emp) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }
      employeeFilter = emp._id;
    }

    const teamQuery = { employerId: req.user.id, role: 'employee' };
    if (employeeFilter) teamQuery._id = employeeFilter;

    const employees = await User.find(teamQuery).select('name email').sort({ name: 1 }).lean();

    if (employees.length === 0) {
      return res.json({
        success: true,
        from,
        to,
        workTimezone: getWorkTimezone(),
        filterEmployeeId: employeeFilter ? String(employeeFilter) : null,
        team: [],
      });
    }

    const employeeIds = employees.map((e) => e._id);

    const docs = await DailyTask.find({
      employerId: req.user.id,
      employeeId: { $in: employeeIds },
      workDate: { $gte: from, $lte: to },
    })
      .sort({ workDate: -1 })
      .lean();

    const byEmp = new Map();
    for (const e of employees) {
      byEmp.set(String(e._id), []);
    }

    for (const doc of docs) {
      const content = resolveContent(doc);
      if (!content.trim()) continue;
      const key = String(doc.employeeId);
      if (!byEmp.has(key)) continue;
      byEmp.get(key).push({
        workDate: doc.workDate,
        content,
        updatedAt: doc.updatedAt || doc.createdAt,
      });
    }

    const team = employees.map((e) => ({
      employeeId: e._id,
      name: e.name,
      email: e.email,
      items: byEmp.get(String(e._id)) || [],
    }));

    res.json({
      success: true,
      from,
      to,
      workTimezone: getWorkTimezone(),
      filterEmployeeId: employeeFilter ? String(employeeFilter) : null,
      team,
    });
  } catch (error) {
    console.error('getEmployerTeamTaskHistory error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
