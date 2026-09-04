const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'electron', 'scriptGenerator.cjs'),
  path.join(__dirname, '..', 'src', 'data', 'scriptGenerator.ts')
];

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  // PowerShell variable names immediately followed by ':' must use ${Name}:.
  text = text.replaceAll('$Description:', '\\${Description}:');

  // Remove interactive console pauses from generated scripts. Handle both
  // normal TS source quotes and escaped quotes present in the bundled CJS.
  text = text.replace(/^[ \t]*Write-Host[ \t]+["']Press any key to exit this optimization session\.\.\.["'][^\r\n]*\r?\n/gim, '');
  text = text.replace(/\$Host\.UI\.RawUI\.ReadKey\(\s*(?:\\["'])?NoEcho,IncludeKeyDown(?:\\["'])?\s*\)\s*/g, '');

  if (text !== before) {
    fs.writeFileSync(file, text, 'utf8');
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
