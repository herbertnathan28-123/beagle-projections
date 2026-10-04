// npm postinstall: installs the Python libs for the Most Improved GIF (ATL-160) into ./.pydeps.
// Skips if python3 already has them; never fails the build (the award send reports a render error instead).
const { execFileSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const run = (args, env) => execFileSync('python3', args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
try {
  run(['-c', 'import matplotlib, PIL, numpy'], { PYTHONPATH: path.join(root, '.pydeps') });
  console.log('[gif-deps] matplotlib/Pillow/numpy already available');
} catch (_) {
  try {
    run(['-m', 'pip', 'install', '--disable-pip-version-check', '--no-warn-script-location', '--target', '.pydeps', '-r', 'requirements-gif.txt']);
    console.log('[gif-deps] installed into .pydeps');
  } catch (e) { console.warn('[gif-deps] WARNING: could not install GIF deps:', e.message); }
}
