/** Fails fast if any icon name referenced by the UI is missing from the free icon set. */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('@hugeicons/core-free-icons/package.json');
const esmEntry = pathToFileURL(pkgPath.replace(/package\.json$/, 'dist/esm/index.js')).href;

const icons = await import(esmEntry);
const available = new Set(Object.keys(icons));

const wanted = process.argv.slice(2);
if (wanted.length === 0) {
  console.log(`available icons: ${available.size}`);
  process.exit(0);
}

const missing = wanted.filter((name) => !available.has(name));
for (const name of wanted) {
  console.log(`${available.has(name) ? 'OK  ' : 'MISS'} ${name}`);
}

if (missing.length > 0) {
  const suggest = (name) => {
    const stem = name.replace(/(0\d)?Icon$/, '').toLowerCase();
    return [...available].filter((candidate) => candidate.toLowerCase().includes(stem)).slice(0, 6);
  };
  console.log('\nsuggestions:');
  for (const name of missing) {
    console.log(`  ${name} -> ${suggest(name).join(', ') || '(none)'}`);
  }
  process.exitCode = 1;
}
