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

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Next calendar day after `ymd` (YYYY-MM-DD), Gregorian, for the work timezone’s civil dates. */
function addOneCalendarDay(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const mdays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeap = (yy) => (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
  let yy = y;
  let mm = m;
  let dd = d + 1;
  let dim = mdays[mm - 1];
  if (mm === 2 && isLeap(yy)) dim = 29;
  if (dd > dim) {
    dd = 1;
    mm += 1;
    if (mm > 12) {
      mm = 1;
      yy += 1;
    }
  }
  return `${yy}-${pad2(mm)}-${pad2(dd)}`;
}

function getTomorrowYmd() {
  return addOneCalendarDay(getWorkDateString());
}

function dateToYmdInWorkTz(date) {
  const tz = getWorkTimezone();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

module.exports = {
  getWorkDateString,
  getWorkTimezone,
  getTomorrowYmd,
  dateToYmdInWorkTz,
};
