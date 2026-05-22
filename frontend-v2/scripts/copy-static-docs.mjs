import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const frontend = resolve(import.meta.dirname, '..');

const copies = [
  ['docs/whitepaper.html', 'dist/docs/whitepaper.html'],
  ['docs/whitepaper.html', 'dist/docs/whitepaper/index.html'],
  ['docs/cred-score-whitepaper.md', 'dist/docs/cred-score-whitepaper.md'],
  ['docs/whitepaper.html', 'dist/whitepaper.html'],
  ['docs/whitepaper.html', 'dist/whitepaper/index.html'],
  ['docs/cred-score-whitepaper.md', 'dist/cred-score-whitepaper.md'],
];

for (const [sourceRelative, targetRelative] of copies) {
  const source = resolve(root, sourceRelative);
  const target = resolve(frontend, targetRelative);

  if (!existsSync(source)) {
    throw new Error(`Missing static doc source: ${sourceRelative}`);
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
