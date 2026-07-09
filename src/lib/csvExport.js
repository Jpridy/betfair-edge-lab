// Generic CSV export utility for any array of objects.

export function exportToCSV(filename, rows, columns) {
  if (!rows || rows.length === 0) {
    // Don't create blank rows — return early with a notification
    console.warn(`CSV export skipped for "${filename}" — no data rows`);
    return false;
  }

  const cols = columns || Object.keys(rows[0]).filter(k => !k.startsWith('_'));

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = cols.map(c => escape(c.label || c.key)).join(',');
  const body = rows.map(row =>
    cols.map(c => escape(row[c.key])).join(',')
  ).join('\n');

  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}