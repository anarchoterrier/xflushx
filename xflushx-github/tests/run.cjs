const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tests = readdirSync(__dirname).filter(name => /^test-.*\.cjs$/.test(name)).sort();
for (const name of tests) {
  const result = spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`${tests.length} test files passed.`);
