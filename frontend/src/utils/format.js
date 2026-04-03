export function formatDate(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString();
}

export function normalizeSeverity(severity) {
  const value = (severity || '').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(value)) return value;
  return 'low';
}
