function tableWords(table: string) {
  return table
    .replace(/^biz_/, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function singularizeLastWord(words: string[]) {
  if (words.length === 0) return words;
  const next = [...words];
  const last = next[next.length - 1];
  if (last.endsWith('ies') && last.length > 3) {
    next[next.length - 1] = `${last.slice(0, -3)}y`;
  } else if (last.endsWith('s') && !last.endsWith('ss') && !last.endsWith('us') && last.length > 3) {
    next[next.length - 1] = last.slice(0, -1);
  }
  return next;
}

export function moduleNameFromTable(table: string) {
  return singularizeLastWord(tableWords(table)).join('');
}

export function permissionPrefixFromTable(table: string) {
  return moduleNameFromTable(table);
}

export function routePathFromTable(table: string) {
  return `/business/${tableWords(table).join('')}`;
}

export function featureNameFromTable(table: string) {
  return tableWords(table).join(' ');
}
