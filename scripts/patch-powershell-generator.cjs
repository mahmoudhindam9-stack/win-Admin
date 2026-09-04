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

  // PowerShell interprets $Description: as a scoped/drive variable reference.
  text = text.replaceAll('$Description:', '${Description}:');

  // The GUI runs scripts non-interactively; waiting for a key can break parsing/execution.
  text = text.replace(/^[ \t]*\$null = \$Host\.UI\.RawUI\.ReadKey\("NoEcho,IncludeKeyDown"\)[ \t]*\r?\n?/gm, '');

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
if (runtime.includes('$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")')) {
  throw new Error('PowerShell generator patch verification failed: ReadKey still present.');
}
console.log('PowerShell generator patch verification passed.');
