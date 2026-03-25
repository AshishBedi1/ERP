const DailyTask = require('../models/DailyTask');
const { getWorkDateString } = require('../utils/workDate');

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
