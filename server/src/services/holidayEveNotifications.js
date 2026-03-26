const Holiday = require('../models/Holiday');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getWorkDateString, getTomorrowYmd, dateToYmdInWorkTz } = require('../utils/workDate');

const TYPE = 'holiday_eve';

function employerObjectId(user) {
  if (user.role === 'employer') return user._id;
  return user.employerId;
}

/**
 * Ensures one notification per recipient per holiday on the eve (work TZ) when tomorrow is that holiday.
 * Idempotent: keyed by userId + holidayId + eveDate (today in work TZ).
 */
async function ensureHolidayEveNotificationsForUser(user) {
  const eid = employerObjectId(user);
  if (!eid) return;

  const todayYmd = getWorkDateString();
  const tomorrowYmd = getTomorrowYmd();

  const holidays = await Holiday.find({ employerId: eid }).lean();
  const matches = holidays.filter((h) => dateToYmdInWorkTz(h.date) === tomorrowYmd);
  if (!matches.length) return;

  const employeeDocs = await User.find({
    employerId: eid,
    role: 'employee',
    isActive: { $ne: false },
  })
    .select('_id')
    .lean();

  const recipientIds = new Set();
  recipientIds.add(eid.toString());
  for (const e of employeeDocs) {
    recipientIds.add(e._id.toString());
  }

  for (const holiday of matches) {
    const title = `Holiday tomorrow: ${holiday.name}`;
    const body = `Tomorrow (${tomorrowYmd}) is a company holiday — ${holiday.name}.`;

    for (const uid of recipientIds) {
      const existing = await Notification.findOne({
        userId: uid,
        type: TYPE,
        holidayId: holiday._id,
        eveDate: todayYmd,
      })
        .select('_id')
        .lean();
      if (existing) continue;

      await Notification.create({
        userId: uid,
        type: TYPE,
        title,
        body,
        holidayId: holiday._id,
        eveDate: todayYmd,
        read: false,
      });
    }
  }
}

module.exports = { ensureHolidayEveNotificationsForUser, TYPE };
