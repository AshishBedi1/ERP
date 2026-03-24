const Holiday = require('../models/Holiday');
const { parseLocalDateInput } = require('../utils/parseLocalDate');

function resolveEmployerId(user) {
  if (user.role === 'employer') return user._id || user.id;
  return user.employerId;
}

// @route   GET /api/holidays
// @desc    List holidays for the current user's organization
// @access  Private (employer + employee)
exports.listHolidays = async (req, res) => {
  try {
    const employerId = resolveEmployerId(req.user);
    if (!employerId) {
      return res.json({ success: true, holidays: [] });
    }

    const holidays = await Holiday.find({ employerId })
      .sort({ date: 1, name: 1 })
      .lean();

    res.json({ success: true, holidays });
  } catch (error) {
    console.error('List holidays error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/holidays
// @desc    Add a holiday
// @access  Private (employer)
exports.createHoliday = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { name, date } = req.body;
    const day = parseLocalDateInput(date);
    if (!day) {
      return res.status(400).json({ success: false, message: 'Invalid date.' });
    }

    const holiday = await Holiday.create({
      employerId,
      name: String(name).trim(),
      date: day,
    });

    res.status(201).json({
      success: true,
      message: 'Holiday added.',
      holiday,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A holiday already exists on this date.',
      });
    }
    console.error('Create holiday error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   PATCH /api/holidays/:id
// @desc    Update a holiday
// @access  Private (employer)
exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;
    const { name, date } = req.body;

    const holiday = await Holiday.findOne({ _id: id, employerId });
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found.' });
    }

    if (name === undefined && date === undefined) {
      return res.status(400).json({ success: false, message: 'No changes provided.' });
    }

    if (name !== undefined) {
      const n = String(name).trim();
      if (!n) {
        return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
      }
      holiday.name = n;
    }

    if (date !== undefined) {
      const day = parseLocalDateInput(date);
      if (!day) {
        return res.status(400).json({ success: false, message: 'Invalid date.' });
      }
      holiday.date = day;
    }

    await holiday.save();

    res.json({ success: true, message: 'Holiday updated.', holiday });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A holiday already exists on this date.',
      });
    }
    console.error('Update holiday error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   DELETE /api/holidays/:id
// @desc    Delete a holiday
// @access  Private (employer)
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;

    const result = await Holiday.deleteOne({ _id: id, employerId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Holiday not found.' });
    }

    res.json({ success: true, message: 'Holiday removed.' });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
