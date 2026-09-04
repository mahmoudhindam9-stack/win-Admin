const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'electron', 'scriptGenerator.cjs'),
  path.join(__dirname, '..', 'src', 'data', 'scriptGenerator.ts')
];

const safeSummary = [
  '# SUMMARY REPORT',
  '$EndTime = Get-Date',
  '$Duration = [math]::Round(($EndTime - $StartTime).TotalSeconds, 1)',
  '$TotalFreedMB = [math]::Round($Global:TotalBytesFreed / 1MB, 2)',
  '$TotalFreedGB = [math]::Round($Global:TotalBytesFreed / 1GB, 3)',
  'Write-Host ""',
  'Write-Host "================================================================================" -ForegroundColor Cyan',
  'Write-Host "                   OPTIMIZATION EXECUTION SUMMARY REPORT                        " -ForegroundColor White',
  'Write-Host "================================================================================" -ForegroundColor Cyan',
  'Write-Host "Execution Status : " -NoNewline -ForegroundColor Gray',
  'Write-Host $(if ($Global:ErrorsLogged -eq 0) { "Completed Successfully" } else { "Completed with Warnings/Errors" }) -ForegroundColor Green',
  'Write-Host "Estimated Space Freed: $TotalFreedMB MB" -ForegroundColor Green',
  'Write-Host "Tasks Completed: $Global:TasksCompleted" -ForegroundColor Green',
  'Write-Host "Tasks Skipped: $Global:TasksSkipped" -ForegroundColor Gray',
  'Write-Host "Warnings Logged: $Global:WarningsLogged" -ForegroundColor Yellow',
  'Write-Host "Errors Logged: $Global:ErrorsLogged" -ForegroundColor $(if ($Global:ErrorsLogged -eq 0) { "Green" } else { "Red" })',
  'Write-Host "Total Duration: $Duration seconds" -ForegroundColor Gray',
  'if ($Global:RequiresReboot) {',
  '    Write-Host "REBOOT RECOMMENDED: Network stack was reset." -ForegroundColor Yellow',
  '} else {',
  '    Write-Host "Windows optimization completed. No restart is required." -ForegroundColor Green',
  '}',
  'Write-Host "================================================================================" -ForegroundColor Cyan'
].join('\n');

const sanitize = (text) => {
  let result = String(text)
    // PowerShell variable names immediately followed by ':' must use ${Name}:.
    .replaceAll('$Description:', '\\${Description}:')
    // Remove any interactive pause line regardless of escaped JS quoting.
    .replace(/^[^\r\n]*Press any key to exit this optimization session[^\r\n]*\r?\n?/gim, '')
    .replace(/^[^\r\n]*\$Host\.UI\.RawUI\.ReadKey\([^\r\n]*\r?\n?/gm, '');

  // Replace the fragile generated summary with a parser-safe summary.
  result = result.replace(/# SUMMARY REPORT[\s\S]*?\r?\n`;\r?\n}/, safeSummary + '\n`;\n}');
  return result;
};

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
if (!runtime.includes('# SUMMARY REPORT') || !runtime.includes('Windows optimization completed. No restart is required.')) {
  throw new Error('PowerShell generator patch verification failed: safe summary not installed.');
}

console.log('PowerShell generator patch verification passed.');
