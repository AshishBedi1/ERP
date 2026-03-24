const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
const { parseLocalDateInput } = require('../utils/parseLocalDate');
const { inclusiveLocalDays, daysOverlappingCalendarYear } = require('../utils/leaveYear');

/** Defaults aligned with company appointment terms (annual leave). */
const POLICY = {
  sick: 5,
  casual: 5,
  earned: 8,
  publicHolidays: 15,
};

function policyFromEmployer(emp) {
  if (!emp) {
    return {
      sick: POLICY.sick,
      casual: POLICY.casual,
      earned: POLICY.earned,
      publicHolidays: POLICY.publicHolidays,
    };
  }
  return {
    sick: emp.sickLeaveAnnual != null ? emp.sickLeaveAnnual : POLICY.sick,
    casual: emp.casualLeaveAnnual != null ? emp.casualLeaveAnnual : POLICY.casual,
    earned: emp.earnedLeaveAnnual != null ? emp.earnedLeaveAnnual : POLICY.earned,
    publicHolidays: emp.publicHolidaysPolicyCount != null ? emp.publicHolidaysPolicyCount : POLICY.publicHolidays,
  };
}

/** Legacy rows may have leaveType "probation"; treat as casual for balances. */
function resolveLeaveType(doc) {
  const t = doc.leaveType || 'casual';
  if (t === 'probation') return 'casual';
  return t;
}

function sumBucketForYear(requests, year, type, statuses) {
  let sum = 0;
  for (const r of requests) {
    if (resolveLeaveType(r) !== type) continue;
    if (!statuses.includes(r.status)) continue;
    sum += daysOverlappingCalendarYear(r.startDate, r.endDate, year);
  }
  return sum;
}

// @route   GET /api/leave/summary
// @access  Private (employee)
exports.getSummary = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can view leave.' });
    }

    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    if (!req.user.employerId) {
      const p = policyFromEmployer(null);
      return res.json({
        success: true,
        calendarYear: year,
        message: 'Your account is not linked to an employer yet.',
        policy: p,
        publicHolidaysPolicyCount: p.publicHolidays,
        publicHolidaysThisYear: 0,
        sick: { entitlement: p.sick, pending: 0, approved: 0, remaining: p.sick },
        casual: { entitlement: p.casual, pending: 0, approved: 0, remaining: p.casual },
        earned: { entitlement: p.earned, pending: 0, approved: 0, remaining: p.earned },
        totalAnnualLeaveDays: p.sick + p.casual + p.earned,
        pendingDaysThisYear: 0,
        approvedDaysThisYear: 0,
        remainingDays: p.sick + p.casual + p.earned,
      });
    }

    const employer = await User.findById(req.user.employerId).select(
      'annualLeaveDays sickLeaveAnnual casualLeaveAnnual earnedLeaveAnnual publicHolidaysPolicyCount'
    );
    const p = policyFromEmployer(employer);

    const requests = await LeaveRequest.find({
      employeeId: req.user.id,
      startDate: { $lte: endOfYear },
      endDate: { $gte: startOfYear },
    });

    const sickPending = sumBucketForYear(requests, year, 'sick', ['pending']);
    const sickApproved = sumBucketForYear(requests, year, 'sick', ['approved']);
    const casualPending = sumBucketForYear(requests, year, 'casual', ['pending']);
    const casualApproved = sumBucketForYear(requests, year, 'casual', ['approved']);
    const earnedPending = sumBucketForYear(requests, year, 'earned', ['pending']);
    const earnedApproved = sumBucketForYear(requests, year, 'earned', ['approved']);

    const holCount = await Holiday.countDocuments({
      employerId: req.user.employerId,
      date: { $gte: startOfYear, $lte: endOfYear },
    });

    const pendingTotalYear = sickPending + casualPending + earnedPending;
    const approvedTotalYear = sickApproved + casualApproved + earnedApproved;

    const totalEntitlement = p.sick + p.casual + p.earned;

    res.json({
      success: true,
      calendarYear: year,
      policy: {
        sick: p.sick,
        casual: p.casual,
        earned: p.earned,
        publicHolidays: p.publicHolidays,
      },
      publicHolidaysPolicyCount: p.publicHolidays,
      publicHolidaysThisYear: holCount,
      sick: {
        entitlement: p.sick,
        pending: sickPending,
        approved: sickApproved,
        remaining: Math.max(0, p.sick - sickApproved - sickPending),
      },
      casual: {
        entitlement: p.casual,
        pending: casualPending,
        approved: casualApproved,
        remaining: Math.max(0, p.casual - casualApproved - casualPending),
      },
      earned: {
        entitlement: p.earned,
        pending: earnedPending,
        approved: earnedApproved,
        remaining: Math.max(0, p.earned - earnedApproved - earnedPending),
      },
      totalAnnualLeaveDays: totalEntitlement,
      pendingDaysThisYear: pendingTotalYear,
      approvedDaysThisYear: approvedTotalYear,
      remainingDays: Math.max(
        0,
        totalEntitlement - sickApproved - casualApproved - earnedApproved - sickPending - casualPending - earnedPending
      ),
    });
  } catch (error) {
    console.error('getSummary leave error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   POST /api/leave/request
// @access  Private (employee)
exports.createRequest = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can request leave.' });
    }
    if (!req.user.employerId) {
      return res.status(400).json({ success: false, message: 'Your account is not linked to an employer.' });
    }

    const { startDate: s, endDate: e, reason, leaveType: ltIn } = req.body;
    const leaveType = ['sick', 'casual', 'earned'].includes(ltIn) ? ltIn : null;
    if (!leaveType) {
      return res.status(400).json({
        success: false,
        message: 'Leave type is required: sick, casual, or earned.',
      });
    }

    const startDate = parseLocalDateInput(s);
    const endDate = parseLocalDateInput(e);
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Valid start and end dates are required.' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ success: false, message: 'End date must be on or after start date.' });
    }

    const days = inclusiveLocalDays(startDate, endDate);

    const employer = await User.findById(req.user.employerId).select(
      'sickLeaveAnnual casualLeaveAnnual earnedLeaveAnnual'
    );
    const p = policyFromEmployer(employer);

    const cap = p[leaveType];
    const allReq = await LeaveRequest.find({ employeeId: req.user.id });

    for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
      const dYear = daysOverlappingCalendarYear(startDate, endDate, y);
      if (dYear === 0) continue;
      const pending = sumBucketForYear(allReq, y, leaveType, ['pending']);
      const approved = sumBucketForYear(allReq, y, leaveType, ['approved']);
      if (pending + approved + dYear > cap) {
        return res.status(400).json({
          success: false,
          message: `Not enough ${leaveType} leave balance for ${y} (policy: ${cap} days).`,
        });
      }
    }

    const doc = await LeaveRequest.create({
      employeeId: req.user.id,
      employerId: req.user.employerId,
      startDate,
      endDate,
      days,
      status: 'pending',
      reason: typeof reason === 'string' ? reason.slice(0, 500) : '',
      leaveType,
    });

    res.status(201).json({
      success: true,
      request: {
        id: doc._id,
        startDate: doc.startDate,
        endDate: doc.endDate,
        days: doc.days,
        status: doc.status,
        leaveType: doc.leaveType,
      },
    });
  } catch (error) {
    console.error('createRequest leave error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @route   GET /api/leave/my-requests
// @access  Private (employee)
exports.listMyRequests = async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ success: false, message: 'Only employees can list leave requests.' });
    }

    const list = await LeaveRequest.find({ employeeId: req.user.id }).sort({ startDate: -1 }).limit(50).lean();

    res.json({
      success: true,
      requests: list.map((r) => ({
        id: r._id,
        startDate: r.startDate,
        endDate: r.endDate,
        days: r.days,
        status: r.status,
        reason: r.reason,
        leaveType: resolveLeaveType(r),
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('listMyRequests leave error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
