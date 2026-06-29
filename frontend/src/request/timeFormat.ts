const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;
const TIME_FIELD_PATTERN = /(^|_)(at|time)$/;

export function formatApiTimes<T>(value: T): T {
  return formatValue(value, '') as T;
}

function formatValue(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        formatValue(entryValue, entryKey),
      ]),
    );
  }

  if (typeof value === 'string' && isTimeField(key) && ISO_DATETIME_PATTERN.test(value)) {
    return formatDateTime(value);
  }

  return value;
}

function isTimeField(key: string): boolean {
  return TIME_FIELD_PATTERN.test(key);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
