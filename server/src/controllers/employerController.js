const User = require('../models/User');
const { parseLocalDateInput } = require('../utils/parseLocalDate');

// @route   POST /api/employer/employees
// @desc    Employer creates employee
// @access  Private (Employer only)
exports.createEmployee = async (req, res) => {
  try {
    const { name, email, password, dateOfJoining: dojRaw } = req.body;
    const employerId = req.user.id;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const dateOfJoining = dojRaw ? parseLocalDateInput(dojRaw) : new Date();

    const employee = await User.create({
      name,
      email,
      password: password || 'ChangeMe123', // Default temp password
      role: 'employee',
      employerId,
      dateOfJoining: dateOfJoining || new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      user: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        employerId: employee.employerId,
      },
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/employer/employees
// @desc    Employer lists their employees
// @access  Private (Employer only)
exports.listEmployees = async (req, res) => {
  try {
    const employees = await User.find({ employerId: req.user.id })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, employees });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   PATCH /api/employer/employees/:id
// @desc    Update an employee belonging to this employer
// @access  Private (Employer only)
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, dateOfJoining: dojRaw } = req.body;

    const employee = await User.findOne({
      _id: id,
      employerId: req.user.id,
      role: 'employee',
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (email !== undefined) {
      const nextEmail = email.trim().toLowerCase();
      if (nextEmail !== employee.email.toLowerCase()) {
        const taken = await User.findOne({ email: nextEmail, _id: { $ne: id } });
        if (taken) {
          return res.status(400).json({ success: false, message: 'Email already in use.' });
        }
        employee.email = nextEmail;
      }
    }

    if (name !== undefined && name.trim()) {
      employee.name = name.trim();
    }

    if (password !== undefined && String(password).trim().length > 0) {
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      }
      employee.password = password;
    }

    if (dojRaw !== undefined) {
      const parsed = parseLocalDateInput(dojRaw);
      if (dojRaw && !parsed) {
        return res.status(400).json({ success: false, message: 'Invalid date of joining.' });
      }
      employee.dateOfJoining = parsed || null;
    }

    await employee.save();

    res.json({
      success: true,
      message: 'Employee updated.',
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        employerId: employee.employerId,
        dateOfJoining: employee.dateOfJoining,
      },
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   DELETE /api/employer/employees/:id
// @desc    Remove an employee from the organization
// @access  Private (Employer only)
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await User.deleteOne({
      _id: id,
      employerId: req.user.id,
      role: 'employee',
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    res.json({ success: true, message: 'Employee removed.' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/employer/me
// @desc    Get employer's company info (for shareable registration link)
// @access  Public (to get employerId for employee registration)
exports.getEmployerPublic = async (req, res) => {
  try {
    const { employerId } = req.params;
    const employer = await User.findOne({ _id: employerId, role: 'employer' }).select(
      'name companyName'
    );

    if (!employer) {
      return res.status(404).json({ success: false, message: 'Employer not found.' });
    }

    res.json({
      success: true,
      employer: {
        id: employer._id,
        name: employer.name,
        companyName: employer.companyName,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
