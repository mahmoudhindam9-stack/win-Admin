const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'electron', 'scriptGenerator.cjs'),
  path.join(__dirname, '..', 'src', 'data', 'scriptGenerator.ts')
];

const sanitize = (text) => String(text)
  // PowerShell variable names immediately followed by ':' must use ${Name}:.
  .replaceAll('$Description:', '\\${Description}:')
  // Remove any interactive pause line regardless of escaped JS quoting.
  .replace(/^[^\r\n]*Press any key to exit this optimization session[^\r\n]*\r?\n?/gim, '')
  .replace(/^[^\r\n]*\$Host\.UI\.RawUI\.ReadKey\([^\r\n]*\r?\n?/gm, '');

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = sanitize(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`Patched PowerShell generator: ${path.relative(process.cwd(), file)}`);
  }
}

const runtimeFile = path.join(__dirname, '..', 'electron', 'scriptGenerator.cjs');
const runtime = fs.existsSync(runtimeFile) ? fs.readFileSync(runtimeFile, 'utf8') : '';

if (runtime.includes('$Description:')) {
  throw new Error('PowerShell generator patch verification failed: $Description: still present.');
}
if (/\$Host\.UI\.RawUI\.ReadKey\(/.test(runtime)) {
  throw new Error('PowerShell generator patch verification failed: ReadKey still present.');
}
if (/Press any key to exit this optimization session/i.test(runtime)) {
  throw new Error('PowerShell generator patch verification failed: interactive pause text still present.');
}

console.log('PowerShell generator patch verification passed.');
