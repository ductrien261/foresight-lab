// Copies the Python core into public/ so the Pyodide worker can load it.
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = 'python/foresight';
const dest = 'public/py/foresight';
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.py'));
// Drop modules that were removed from the source so public/ mirrors it exactly.
for (const f of readdirSync(dest)) if (f.endsWith('.py') && !files.includes(f)) rmSync(join(dest, f));
for (const f of files) copyFileSync(join(src, f), join(dest, f));
writeFileSync(join(dest, 'manifest.json'), JSON.stringify(files));
console.log(`copied ${files.length} python files to ${dest}`);
