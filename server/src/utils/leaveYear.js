function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Inclusive calendar days between two local dates (start ≤ end). */
function inclusiveLocalDays(start, end) {
  const s = stripTime(start);
  const e = stripTime(end);
  if (e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

/** Days of [start, end] that fall in the given calendar year (local). */
function daysOverlappingCalendarYear(start, end, year) {
  const ys = new Date(year, 0, 1);
  const ye = new Date(year, 11, 31);
  const s = stripTime(start);
  const e = stripTime(end);
  const rangeStart = s > ys ? s : ys;
  const rangeEnd = e < ye ? e : ye;
  if (rangeEnd < rangeStart) return 0;
  return inclusiveLocalDays(rangeStart, rangeEnd);
}

module.exports = {
  stripTime,
  inclusiveLocalDays,
  daysOverlappingCalendarYear,
};
