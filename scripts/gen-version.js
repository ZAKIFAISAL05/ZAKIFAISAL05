/**
 * Generate `version.json` untuk auto-update cache di browser.
 *
 * Dipanggil otomatis oleh `npm run build`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function pad2(n) { return String(n).padStart(2, '0'); }

function makeVersionStamp(d) {
  // Format: YYYYMMDDHHmmss (urut lexicographically & gampang dibandingin)
  return [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate()),
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds()),
  ].join('');
}

function main() {
  const now = new Date();
  const version = makeVersionStamp(now);
  const payload = {
    version,
    generatedAt: now.toISOString(),
  };

  const outPath = path.join(process.cwd(), 'version.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  process.stdout.write(`Generated version.json: ${version}\n`);
}

main();
