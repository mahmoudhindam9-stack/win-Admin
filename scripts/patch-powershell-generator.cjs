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

  // PowerShell interprets $Description: ambiguously inside generated strings.
  // These JavaScript template literals must escape the ${...} interpolation.
  text = text.replaceAll('$Description:', '\\${Description}:');

  // GUI execution is non-interactive. Remove ReadKey regardless of whitespace
  // or line formatting so generated PowerShell never waits for console input.
  text = text.replace(/\$Host\.UI\.RawUI\.ReadKey\(\s*"NoEcho,IncludeKeyDown"\s*\)\s*/g, '');

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
if (!runtime.includes('\\${Description}:')) {
  throw new Error('PowerShell generator patch verification failed: escaped ${Description}: not present in generator source.');
}

console.log('PowerShell generator patch verification passed.');
