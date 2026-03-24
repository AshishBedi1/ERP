const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

/** Employer: own companyName. Employee: resolved from employer document. */
async function buildUserResponse(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject({ virtuals: true }) : { ...userDoc };
  let companyName = user.companyName || null;
  if (user.role === 'employee' && user.employerId) {
    const employer = await User.findById(user.employerId).select('companyName name');
    if (employer) {
      companyName = employer.companyName || employer.name || null;
    }
  }
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyName,
    employerId: user.employerId,
  };
}

// @route   POST /api/auth/register
// @desc    Register user (employer or employee)
// @access  Public (employees need employer code; employers open; admin via seed)
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role, companyName, employerId } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // Validate role - only employer and employee can self-register
    const allowedRoles = ['employer', 'employee'];
    const userRole = role || 'employee';
    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role for registration.' });
    }

    // Employee must have employerId
    if (userRole === 'employee' && !employerId) {
      return res.status(400).json({
        success: false,
        message: 'Employees must provide employer/company ID to register.',
      });
    }

    // Employer must have company name
    if (userRole === 'employer' && !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Employers must provide company name.',
      });
    }

    // Verify employer exists for employees
    if (userRole === 'employee') {
      const employer = await User.findOne({ _id: employerId, role: 'employer' });
      if (!employer) {
        return res.status(400).json({ success: false, message: 'Invalid employer ID.' });
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      companyName: userRole === 'employer' ? companyName : undefined,
      employerId: userRole === 'employee' ? employerId : undefined,
      annualLeaveDays: userRole === 'employer' ? 18 : undefined,
      sickLeaveAnnual: userRole === 'employer' ? 5 : undefined,
      casualLeaveAnnual: userRole === 'employer' ? 5 : undefined,
      earnedLeaveAnnual: userRole === 'employer' ? 8 : undefined,
      publicHolidaysPolicyCount: userRole === 'employer' ? 15 : undefined,
      dateOfJoining: userRole === 'employee' ? new Date() : undefined,
    });

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: await buildUserResponse(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, role: loginAs } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated.' });
    }

    // Must match the role chosen on the login screen (employer vs employee)
    if (loginAs && user.role !== loginAs) {
      if (loginAs === 'employer') {
        // Same message as wrong password — do not reveal that this email is an employee account
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      return res.status(403).json({
        success: false,
        message: 'No employee account for this email. Ask your employer for an invite link.',
      });
    }

    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: await buildUserResponse(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: await buildUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
