/**
 * Calendar date string YYYY-MM-DD in the configured timezone (default India).
 * A new work day starts at **12:00 AM** (midnight) in this timezone — used for attendance reset.
 */
function getWorkTimezone() {
  return process.env.WORK_TIMEZONE || 'Asia/Kolkata';
}

function getWorkDateString(d = new Date()) {
  const tz = getWorkTimezone();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

module.exports = { getWorkDateString, getWorkTimezone };
