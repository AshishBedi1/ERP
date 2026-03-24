/** Parse YYYY-MM-DD as local calendar date (avoids UTC off-by-one). */
function parseLocalDateInput(value) {
  if (value == null || value === '') return null;
  const s = String(value).split('T')[0];
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

module.exports = { parseLocalDateInput };
