export function formatDateForApi(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeDateString(value) {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  if (text.includes("T")) return text;
  if (text.includes(" ")) return text.replace(" ", "T");

  return text;
}
