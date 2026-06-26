export function includesText(value: unknown, keyword: unknown) {
  const text = String(keyword ?? '').trim().toLowerCase();
  if (!text) return true;
  return String(value ?? '').toLowerCase().includes(text);
}

export function matchesFields<T extends Record<string, unknown>>(row: T, params: Record<string, unknown>, fields: Array<keyof T>) {
  return fields.every((field) => includesText(row[field], params[field as string]));
}
