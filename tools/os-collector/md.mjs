// Markdown-tabeller ur AI Native OS-registren. Hanterar \| inne i [[länk\|alias]].
const splitRow = (line) =>
  line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
const isSep = (line) => /^\s*\|?\s*:?-{3,}/.test(line);

export function parseTables(md) {
  const lines = md.split(/\r?\n/), out = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trim().startsWith('|') || !isSep(lines[i + 1])) continue;
    const headers = splitRow(lines[i]), rows = [];
    let j = i + 2;
    for (; j < lines.length && lines[j].trim().startsWith('|'); j++) {
      const cells = splitRow(lines[j]);
      rows.push(Object.fromEntries(headers.map((h, k) => [h, cells[k] ?? ''])));
    }
    out.push({ headers, rows });
    i = j - 1;
  }
  return out;
}

export const clean = (s) => (s ?? '')
  .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1')
  .replace(/\[\[([^\]]+)\]\]/g, (_, p) => p.split('/').pop())
  .replace(/\*\*|`/g, '')
  .replace(/\s+/g, ' ').trim();
