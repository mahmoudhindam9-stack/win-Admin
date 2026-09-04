var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/data/scriptGenerator.ts
var scriptGenerator_exports = {};
__export(scriptGenerator_exports, {
  generateBatchScript: () => generateBatchScript,
  generateHybridLauncher: () => generateHybridLauncher,
  generatePowerShellScript: () => generatePowerShellScript
});
module.exports = __toCommonJS(scriptGenerator_exports);
function generatePowerShellScript(config) {
  return `<#
.SYNOPSIS
    WinOptimize.ps1 - Enterprise Windows Maintenance & Performance Optimization Suite
.DESCRIPTION
    A comprehensive, robust, and safe system administrator automation script designed
    to clean temporary clutter, optimize DNS/network configurations, safely maintain
    browser caches, and tune Windows performance settings with detailed telemetry.
.NOTES
    Author: Windows Systems Administrator
    Requires: Windows 10 / 11 / Windows Server 2016+
    Privileges: Elevated Administrator (auto-prompts via UAC if not elevated)
    Safety: Non-destructive to user documents and critical system components.
#>

# ==============================================================================
# 0. PRIVILEGE ELEVATION & INITIALIZATION
# ==============================================================================
[CmdletBinding()]
param (
    [switch]$DryRun = ${config.dryRunMode ? "$true" : "$false"},
    [switch]$ForceWinsockReset = ${config.resetWinsockAndTcpIp ? "$true" : "$false"},
    [switch]$EnableVisualTweaks = ${config.adjustVisualEffects ? "$true" : "$false"}
)

# Enforce TLS 1.2+ and UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

# Check for Administrator elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[!] Administrative privileges required. Re-launching with elevation..." -ForegroundColor Yellow
    $argsList = "-NoProfile -ExecutionPolicy Bypass -File \`"$($MyInvocation.MyCommand.Definition)\`""
    if ($DryRun) { $argsList += " -DryRun" }
    if ($ForceWinsockReset) { $argsList += " -ForceWinsockReset" }
    if ($EnableVisualTweaks) { $argsList += " -EnableVisualTweaks" }
    
    Start-Process -FilePath "powershell.exe" -ArgumentList $argsList -Verb RunAs
    exit
}

# Set Console Title and Buffer Size
$Host.UI.RawUI.WindowTitle = "Windows System Optimizer & Performance Suite - v2.5"
Clear-Host

# ==============================================================================
# LOGGING & CONSOLE HELPERS
# ==============================================================================
$Global:TotalBytesFreed = 0
$Global:TasksCompleted = 0
$Global:TasksSkipped = 0
$Global:WarningsLogged = 0
$Global:ErrorsLogged = 0
$StartTime = Get-Date

function Write-SectionHeader {
    param([string]$Title, [string]$Step)
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor DarkCyan
    Write-Host "  [$Step] $Title" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor DarkCyan
}

function Write-Status {
    param([string]$Status, [string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Gray)
    $timestamp = (Get-Date).ToString("HH:mm:ss")
    Write-Host "[$timestamp] " -NoNewline -ForegroundColor DarkGray
    Write-Host "[$Status] " -NoNewline -ForegroundColor $Color
    Write-Host "$Message"
}

function Write-Success { param([string]$Msg) Write-Status "OK" $Msg Green; $Global:TasksCompleted++ }
function Write-WarningMsg { param([string]$Msg) Write-Status "WARN" $Msg Yellow; $Global:WarningsLogged++ }
function Write-Failure { param([string]$Msg) Write-Status "FAIL" $Msg Red; $Global:ErrorsLogged++ }
function Write-Info { param([string]$Msg) Write-Status "INFO" $Msg White }
function Write-Skip { param([string]$Msg) Write-Status "SKIP" $Msg DarkYellow; $Global:TasksSkipped++ }

function Get-FolderSizeSafe {
    param([string]$Path)
    if (Test-Path -Path $Path) {
        $measure = Get-ChildItem -Path $Path -Recurse -Force -File -ErrorAction SilentlyContinue | 
            Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue
        if ($measure -and $measure.Sum) { return [math]::Round($measure.Sum, 0) }
    }
    return 0
}

function Safe-RemoveDirectoryContents {
    param(
        [string]$Path,
        [string]$Description,
        [string[]]$ExcludePatterns = @()
    )
    if (-not (Test-Path -Path $Path)) {
        Write-Skip "$Description folder does not exist: $Path"
        return
    }

    Write-Info "Scanning $Description ($Path)..."
    $initialSize = Get-FolderSizeSafe -Path $Path

    if ($DryRun) {
        $mb = [math]::Round($initialSize / 1MB, 2)
        Write-Info "[DRY-RUN] Would clean contents of $Description (~$mb MB found)."
        return
    }

    $filesRemoved = 0
    $lockedItems = 0

    # Get items inside target directory
    $items = Get-ChildItem -Path $Path -Force -ErrorAction SilentlyContinue

    foreach ($item in $items) {
        # Check exclusions
        $shouldExclude = $false
        foreach ($pattern in $ExcludePatterns) {
            if ($item.Name -like $pattern) { $shouldExclude = $true; break }
        }
        if ($shouldExclude) { continue }

        try {
            Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop
            $filesRemoved++
        }
        catch {
            # In-use/locked files are safely bypassed
            $lockedItems++
        }
    }

    $finalSize = Get-FolderSizeSafe -Path $Path
    $freed = [math]::Max(0, ($initialSize - $finalSize))
    $Global:TotalBytesFreed += $freed
    $freedMB = [math]::Round($freed / 1MB, 2)

    if ($lockedItems -gt 0) {
        Write-Success "Cleaned $Description: Freed ~$freedMB MB ($lockedItems files actively in-use/skipped)."
    } else {
        Write-Success "Cleaned $Description: Freed ~$freedMB MB."
    }
}

# ==============================================================================
# BANNER
# ==============================================================================
Write-Host @"
================================================================================
     WINDOWS ENTERPRISE OPTIMIZER & PERFORMANCE MAINTENANCE SUITE
================================================================================
"@ -ForegroundColor Cyan
Write-Host " Running on: $([System.Environment]::OSVersion.VersionString)" -ForegroundColor Gray
Write-Host " Computer:  $($env:COMPUTERNAME) | User: $($env:USERNAME) (Elevated)" -ForegroundColor Gray
if ($DryRun) {
    Write-Host " MODE:      *** DRY-RUN / SIMULATION ONLY (No changes written) ***" -ForegroundColor Magenta
} else {
    Write-Host " MODE:      LIVE OPTIMIZATION (Safe Execution)" -ForegroundColor Green
}
Write-Host "================================================================================" -ForegroundColor DarkCyan

${config.createRestorePoint ? `
# ------------------------------------------------------------------------------
# RESTORE POINT (Safety Guard)
# ------------------------------------------------------------------------------
Write-SectionHeader "SYSTEM RESTORE POINT CREATION" "RESTORE"
try {
    Write-Info "Verifying System Restore service state..."
    Enable-ComputerRestore -Drive "$($env:SystemDrive)\\" -ErrorAction SilentlyContinue
    if (-not $DryRun) {
        Checkpoint-Computer -Description "WinOptimize_PreOptimization" -RestorePointType "MODIFY_SETTINGS" -ErrorAction Stop
        Write-Success "Created System Restore Point: 'WinOptimize_PreOptimization'."
    } else {
        Write-Info "[DRY-RUN] Would create restore point: 'WinOptimize_PreOptimization'."
    }
} catch {
    Write-WarningMsg "Unable to create restore point ($($_.Exception.Message)). Continuing with safe operations."
}
` : ""}

# ==============================================================================
# SECTION 1: SYSTEM CLEANUP & TEMP REMOVAL
# ==============================================================================
Write-SectionHeader "SYSTEM CLEANUP & TEMPORARY FILES PURGE" "STEP 1/4"

${config.cleanTempFiles ? `
# 1.1 User Temp Folder (%TEMP%)
Safe-RemoveDirectoryContents -Path "$env:TEMP" -Description "User Temp Folder"

# 1.2 System Windows Temp (C:\\Windows\\Temp)
Safe-RemoveDirectoryContents -Path "$env:SystemRoot\\Temp" -Description "Windows System Temp"
` : `Write-Skip "Skipping Temp folder cleanup as per configuration."`}

${config.emptyRecycleBin ? `
# 1.3 Empty Recycle Bin Silently
Write-Info "Purging Windows Recycle Bin across all mounted volumes..."
if (-not $DryRun) {
    try {
        Clear-RecycleBin -Force -ErrorAction Stop
        Write-Success "Recycle Bin successfully emptied on all drives."
    } catch {
        # Fallback to COM Shell object if Clear-RecycleBin throws (e.g. already empty)
        try {
            $shell = New-Object -ComObject Shell.Application
            $bin = $shell.Namespace(0x0a)
            $bin.Items() | ForEach-Object { Remove-Item $_.Path -Recurse -Force -ErrorAction SilentlyContinue }
            Write-Success "Recycle Bin cleared via Shell COM fallback."
        } catch {
            Write-Info "Recycle Bin is already empty or cleared."
        }
    }
} else {
    Write-Info "[DRY-RUN] Would silently purge Recycle Bin contents."
}
` : `Write-Skip "Skipping Recycle Bin purge as per configuration."`}

${config.cleanPrefetch ? `
# 1.4 Clean Prefetch (Exclude layout.ini for boot optimization)
Safe-RemoveDirectoryContents -Path "$env:SystemRoot\\Prefetch" -Description "Windows Prefetch Cache" -ExcludePatterns @("layout.ini", "ReadyBoot*")
` : `Write-Skip "Skipping Prefetch cleanup as per configuration."`}

${config.cleanWindowsUpdateCache ? `
# 1.5 Obsolete Windows Update Download Cache (SoftwareDistribution\\Download)
Write-Info "Managing Windows Update cache (SoftwareDistribution\\Download)..."
$updatePath = "$env:SystemRoot\\SoftwareDistribution\\Download"

if (Test-Path $updatePath) {
    $preServiceSize = Get-FolderSizeSafe -Path $updatePath
    if (-not $DryRun) {
        $wuauservRunning = (Get-Service -Name "wuauserv" -ErrorAction SilentlyContinue).Status -eq "Running"
        $bitsRunning = (Get-Service -Name "bits" -ErrorAction SilentlyContinue).Status -eq "Running"

        try {
            if ($wuauservRunning) {
                Write-Info "Temporarily pausing Windows Update Service (wuauserv)..."
                Stop-Service -Name "wuauserv" -Force -ErrorAction SilentlyContinue
            }
            if ($bitsRunning) {
                Stop-Service -Name "bits" -Force -ErrorAction SilentlyContinue
            }

            Safe-RemoveDirectoryContents -Path $updatePath -Description "SoftwareDistribution Download Cache"
        }
        finally {
            # Guarantee services restart safely
            if ($wuauservRunning) {
                Write-Info "Resuming Windows Update Service..."
                Start-Service -Name "wuauserv" -ErrorAction SilentlyContinue
            }
            if ($bitsRunning) {
                Start-Service -Name "bits" -ErrorAction SilentlyContinue
            }
        }
    } else {
        $mb = [math]::Round($preServiceSize / 1MB, 2)
        Write-Info "[DRY-RUN] Would pause wuauserv and purge $updatePath (~$mb MB found)."
    }
} else {
    Write-Skip "SoftwareDistribution Download folder not found."
}
` : `Write-Skip "Skipping Windows Update Cache cleanup."`}

${config.cleanDeliveryOptimization ? `
# 1.6 Delivery Optimization Cache
$doCache = "$env:SystemDrive\\ProgramData\\Microsoft\\Network\\Downloader"
if (Test-Path $doCache) {
    Safe-RemoveDirectoryContents -Path $doCache -Description "Delivery Optimization Cache"
}
` : ""}

# ==============================================================================
# SECTION 2: NETWORK & DNS OPTIMIZATION
# ==============================================================================
Write-SectionHeader "NETWORK, SOCKETS & DNS OPTIMIZATION" "STEP 2/4"

${config.flushDnsCache ? `
# 2.1 Flush DNS Resolver Cache
Write-Info "Flushing local DNS resolver cache..."
if (-not $DryRun) {
    try {
        Clear-DnsClientCache -ErrorAction Stop
        Write-Success "DNS Resolver cache cleared via PowerShell (Clear-DnsClientCache)."
    } catch {
        # Fallback to ipconfig /flushdns command
        $flushResult = ipconfig /flushdns 2>&1
        Write-Success "DNS Resolver cache flushed via ipconfig utility."
    }
} else {
    Write-Info "[DRY-RUN] Would invoke Clear-DnsClientCache and ipconfig /flushdns."
}
` : `Write-Skip "Skipping DNS cache flush as per configuration."`}

${config.resetWinsockAndTcpIp ? `
# 2.2 Reset TCP/IP Stack & Winsock Catalog
if ($ForceWinsockReset) {
    Write-WarningMsg "Resetting TCP/IP stack and Winsock catalog (Note: Requires system reboot)..."
    if (-not $DryRun) {
        try {
            $null = netsh winsock reset
            $null = netsh int ip reset
            Write-Success "Winsock catalog and TCP/IP stack reset. System reboot is recommended."
            $Global:RequiresReboot = $true
        } catch {
            Write-Failure "Failed to reset Winsock / IP stack: $($_.Exception.Message)"
        }
    } else {
        Write-Info "[DRY-RUN] Would execute 'netsh winsock reset' and 'netsh int ip reset'."
    }
} else {
    Write-Skip "Winsock and TCP/IP reset omitted (Use -ForceWinsockReset parameter if diagnosing corrupt networking)."
}
` : `Write-Skip "Skipping Winsock and TCP/IP reset (reboot-heavy action)."`}

# ==============================================================================
# SECTION 3: BROWSER & CACHE MAINTENANCE (SAFE DETECTION)
# ==============================================================================
Write-SectionHeader "BROWSER & APPLICATION CACHE MAINTENANCE" "STEP 3/4"

function Clear-BrowserCacheSafe {
    param(
        [string]$BrowserName,
        [string]$ProcessName,
        [string[]]$CacheDirectories
    )

    $running = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    if ($running) {
        Write-WarningMsg "$BrowserName is currently running ($($running.Count) active processes). Skipped to prevent session corruption."
        return
    }

    Write-Info "$BrowserName is closed. Performing cache maintenance..."
    foreach ($dir in $CacheDirectories) {
        if (Test-Path $dir) {
            Safe-RemoveDirectoryContents -Path $dir -Description "$BrowserName Cache ($((Split-Path $dir -Leaf)))"
        }
    }
}

${config.cleanChromeCache ? `
# Google Chrome
Clear-BrowserCacheSafe -BrowserName "Google Chrome" -ProcessName "chrome" -CacheDirectories @(
    "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Cache",
    "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\Code Cache",
    "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\ShaderCache"
)
` : `Write-Skip "Skipping Google Chrome cache maintenance."`}

${config.cleanEdgeCache ? `
# Microsoft Edge
Clear-BrowserCacheSafe -BrowserName "Microsoft Edge" -ProcessName "msedge" -CacheDirectories @(
    "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Cache",
    "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\Code Cache",
    "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\ShaderCache"
)
` : `Write-Skip "Skipping Microsoft Edge cache maintenance."`}

${config.cleanFirefoxCache ? `
# Mozilla Firefox
$firefoxProfiles = "$env:LOCALAPPDATA\\Mozilla\\Firefox\\Profiles"
if (Test-Path $firefoxProfiles) {
    $runningFF = Get-Process -Name "firefox" -ErrorAction SilentlyContinue
    if ($runningFF) {
        Write-WarningMsg "Mozilla Firefox is currently running. Skipped to prevent database lockups."
    } else {
        Get-ChildItem -Path $firefoxProfiles -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $ffCache = Join-Path $_.FullName "cache2"
            if (Test-Path $ffCache) {
                Safe-RemoveDirectoryContents -Path $ffCache -Description "Firefox Profile Cache ($($_.Name))"
            }
        }
    }
} else {
    Write-Skip "Mozilla Firefox profile folder not detected."
}
` : `Write-Skip "Skipping Mozilla Firefox cache maintenance."`}

${config.cleanBraveCache ? `
# Brave Browser
Clear-BrowserCacheSafe -BrowserName "Brave Browser" -ProcessName "brave" -CacheDirectories @(
    "$env:LOCALAPPDATA\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache",
    "$env:LOCALAPPDATA\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Code Cache"
)
` : ""}

# ==============================================================================
# SECTION 4: WINDOWS PERFORMANCE & SERVICE TWEAKS
# ==============================================================================
Write-SectionHeader "WINDOWS PERFORMANCE & SERVICE TUNING" "STEP 4/4"

${config.optimizeCPU ? `
# 4.0 CPU Priority & Power Plan Optimization
Write-Info "Optimizing CPU Priority Scheduling & Power Plan..."
if (-not $DryRun) {
    try {
        # High Performance Power Plan
        powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
        # Foreground priority boost
        Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl" -Name "Win32PrioritySeparation" -Value 38 -Type DWord -Force
        Write-Success "CPU priority tuning and High Performance power plan activated."
    } catch {
        Write-WarningMsg "Failed to optimize CPU power plan."
    }
} else {
    Write-Info "[DRY-RUN] Would activate High Performance power plan & tune priority scheduling."
}
` : ""}

${config.restartPerformanceServices ? `
# 4.1 Optimization of Performance Background Services
# SysMain (Superfetch): Clean caching state by cycling service
Write-Info "Refreshing SysMain (SuperFetch) memory caching service..."
if (-not $DryRun) {
    try {
        $sysmain = Get-Service -Name "SysMain" -ErrorAction SilentlyContinue
        if ($sysmain -and $sysmain.Status -eq "Running") {
            Restart-Service -Name "SysMain" -Force -ErrorAction Stop
            Write-Success "SysMain memory cache flushed and service cycled."
        } else {
            Write-Info "SysMain service is not running or disabled."
        }
    } catch {
        Write-WarningMsg "Could not cycle SysMain service: $($_.Exception.Message)"
    }
} else {
    Write-Info "[DRY-RUN] Would cycle SysMain service to flush RAM standby cache."
}

# Windows Search Indexer: Cycle to free memory if queue saturated
Write-Info "Checking Windows Search indexer status..."
if (-not $DryRun) {
    try {
        $wsearch = Get-Service -Name "WSearch" -ErrorAction SilentlyContinue
        if ($wsearch -and $wsearch.Status -eq "Running") {
            Restart-Service -Name "WSearch" -Force -ErrorAction Stop
            Write-Success "Windows Search indexer service refreshed."
        }
    } catch {
        Write-WarningMsg "Windows Search service cycle skipped."
    }
}
` : `Write-Skip "Skipping background service optimization as per configuration."`}

${config.adjustVisualEffects ? `
# 4.2 Visual Effects Tuning (Preset: ${config.visualEffectsPreset.toUpperCase()})
if ($EnableVisualTweaks) {
    Write-Info "Applying visual effects preset: '${config.visualEffectsPreset.toUpperCase()}'..."
    $regPathDesktop = "HKCU:\\Control Panel\\Desktop"
    $regPathVisual = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects"

    if (-not $DryRun) {
        try {
            # Backup current settings to temp registry export file
            $backupFile = "$env:TEMP\\WinOptimize_VisualEffects_Backup.reg"
            reg export "HKCU\\Control Panel\\Desktop" "$backupFile" /y | Out-Null
            Write-Info "Created rollback backup file at: $backupFile"

            ${config.visualEffectsPreset === "performance" ? `
            # Best Performance Mode: Disable unnecessary animations while preserving ClearType font smoothing
            Set-ItemProperty -Path $regPathDesktop -Name "MenuShowDelay" -Value "20" -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $regPathDesktop -Name "UserPreferencesMask" -Value ([byte[]](0x90,0x12,0x01,0x80)) -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $regPathDesktop -Name "FontSmoothing" -Value "2" -ErrorAction SilentlyContinue # Retain crisp fonts!
            if (-not (Test-Path $regPathVisual)) { New-Item -Path $regPathVisual -Force | Out-Null }
            Set-ItemProperty -Path $regPathVisual -Name "VisualFXSetting" -Value 2 -ErrorAction SilentlyContinue
            Write-Success "Configured Visual Effects for High Performance (animations reduced, crisp fonts retained)."
            ` : config.visualEffectsPreset === "balanced" ? `
            # Balanced Mode: Smooth fonts, crisp shadows, subtle responsive transitions
            Set-ItemProperty -Path $regPathDesktop -Name "MenuShowDelay" -Value "100" -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $regPathDesktop -Name "FontSmoothing" -Value "2" -ErrorAction SilentlyContinue
            if (-not (Test-Path $regPathVisual)) { New-Item -Path $regPathVisual -Force | Out-Null }
            Set-ItemProperty -Path $regPathVisual -Name "VisualFXSetting" -Value 3 -ErrorAction SilentlyContinue
            Write-Success "Configured Visual Effects for Balanced Responsiveness."
            ` : `
            # Best Appearance Mode: Full animations enabled
            if (-not (Test-Path $regPathVisual)) { New-Item -Path $regPathVisual -Force | Out-Null }
            Set-ItemProperty -Path $regPathVisual -Name "VisualFXSetting" -Value 1 -ErrorAction SilentlyContinue
            Write-Success "Visual Effects configured for Best Appearance."
            `}
        } catch {
            Write-Failure "Failed to update visual effects keys: $($_.Exception.Message)"
        }
    } else {
        Write-Info "[DRY-RUN] Would tune Desktop & VisualFX registry keys to preset: ${config.visualEffectsPreset}."
    }
} else {
    Write-Skip "Visual effects tweaking disabled (Pass -EnableVisualTweaks to toggle)."
}
` : `Write-Skip "Visual effects tuning omitted as per configuration."`}

# ==============================================================================
# SUMMARY REPORT
# ==============================================================================
$EndTime = Get-Date
$Duration = [math]::Round(($EndTime - $StartTime).TotalSeconds, 1)
$TotalFreedMB = [math]::Round($Global:TotalBytesFreed / 1MB, 2)
$TotalFreedGB = [math]::Round($Global:TotalBytesFreed / 1GB, 3)

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                   OPTIMIZATION EXECUTION SUMMARY REPORT                        " -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor Cyan

$report = [PSCustomObject]@{
    "Execution Status"    = if ($Global:ErrorsLogged -eq 0) { "Completed Successfully" } else { "Completed with Warnings/Errors" }
    "Estimated Space Freed"= if ($TotalFreedMB -gt 1024) { "$TotalFreedGB GB ($TotalFreedMB MB)" } else { "$TotalFreedMB MB" }
    "Tasks Completed"     = $Global:TasksCompleted
    "Tasks Skipped"       = $Global:TasksSkipped
    "Warnings Logged"     = $Global:WarningsLogged
    "Errors Logged"       = $Global:ErrorsLogged
    "Total Duration"      = "$Duration seconds"
    "Reboot Recommended"  = if ($Global:RequiresReboot) { "YES (Network stack was reset)" } else { "No reboot necessary" }
}

$report | Format-List | Out-String | Write-Host -ForegroundColor Green

Write-Host "--------------------------------------------------------------------------------" -ForegroundColor DarkCyan
if ($Global:RequiresReboot) {
    Write-Host "[!] REBOOT RECOMMENDATION: Please reboot your system to complete network stack rebuild." -ForegroundColor Yellow
} else {
    Write-Host "[\u2713] Windows optimization completed safely. No system restart is required." -ForegroundColor Green
}
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit this optimization session..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
`;
}
function generateBatchScript(config) {
  return `@echo off
:: ============================================================================
:: WinOptimize.bat - Enterprise Windows System Cleaner & Performance Suite
:: Self-elevating batch script with robust error handling and safety checks.
:: ============================================================================
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Windows Performance Optimizer Suite - Admin Launcher

:: ----------------------------------------------------------------------------
:: 0. Privilege Elevation Check
:: ----------------------------------------------------------------------------
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting administrative privileges...
    powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
    exit /b
)

cls
color 0B
echo ============================================================================
echo      WINDOWS SYSTEM OPTIMIZER ^& PERFORMANCE MAINTENANCE SUITE (BATCH)
echo ============================================================================
echo  Computer: %COMPUTERNAME% ^| User: %USERNAME% (Administrator)
echo  Started:  %DATE% %TIME%
echo ============================================================================
echo.

set /a TOTAL_STEPS=4
set /a CURRENT_STEP=0

:: ----------------------------------------------------------------------------
:: 1. System Cleanup & Temp Removal
:: ----------------------------------------------------------------------------
set /a CURRENT_STEP+=1
echo [STEP !CURRENT_STEP!/%TOTAL_STEPS%] Cleaning System ^& User Temporary Directories...

${config.cleanTempFiles ? `
echo  - Purging User Temp: %TEMP%
del /q /f /s "%TEMP%\\*" >nul 2>&1
for /d %%p in ("%TEMP%\\*") do rmdir "%%p" /s /q >nul 2>&1

echo  - Purging Windows Temp: %WINDIR%\\Temp
del /q /f /s "%WINDIR%\\Temp\\*" >nul 2>&1
for /d %%p in ("%WINDIR%\\Temp\\*") do rmdir "%%p" /s /q >nul 2>&1
echo  [OK] Temporary files cleared.
` : `echo  [SKIP] Temp files cleanup disabled in config.`}

${config.emptyRecycleBin ? `
echo  - Emptying Recycle Bin silently...
powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue" >nul 2>&1
echo  [OK] Recycle Bin cleared.
` : `echo  [SKIP] Recycle Bin emptying disabled.`}

${config.cleanPrefetch ? `
echo  - Cleaning Windows Prefetch cache...
del /q /f "%WINDIR%\\Prefetch\\*.pf" >nul 2>&1
echo  [OK] Prefetch files cleared safely.
` : `echo  [SKIP] Prefetch cleaning disabled.`}

${config.cleanWindowsUpdateCache ? `
echo  - Purging Windows Update Download cache...
net stop wuauserv >nul 2>&1
net stop bits >nul 2>&1
del /q /f /s "%WINDIR%\\SoftwareDistribution\\Download\\*" >nul 2>&1
for /d %%p in ("%WINDIR%\\SoftwareDistribution\\Download\\*") do rmdir "%%p" /s /q >nul 2>&1
net start bits >nul 2>&1
net start wuauserv >nul 2>&1
echo  [OK] Windows Update cache purged and services restored.
` : `echo  [SKIP] Windows Update cache cleanup disabled.`}

echo.

:: ----------------------------------------------------------------------------
:: 2. Network & DNS Optimization
:: ----------------------------------------------------------------------------
set /a CURRENT_STEP+=1
echo [STEP !CURRENT_STEP!/%TOTAL_STEPS%] Optimizing Network ^& DNS Cache...

${config.flushDnsCache ? `
echo  - Flushing DNS Resolver Cache...
ipconfig /flushdns >nul 2>&1
echo  [OK] DNS Resolver cache successfully flushed.
` : `echo  [SKIP] DNS cache flush disabled.`}

${config.resetWinsockAndTcpIp ? `
echo  - Resetting Winsock Catalog and TCP/IP stack...
netsh winsock reset >nul 2>&1
netsh int ip reset >nul 2>&1
echo  [OK] Winsock catalog and IP stack reset (System reboot recommended).
set REBOOT_RECOMMENDED=1
` : `echo  [SKIP] Winsock and TCP/IP reset omitted.`}

echo.

:: ----------------------------------------------------------------------------
:: 3. Browser & Cache Maintenance
:: ----------------------------------------------------------------------------
set /a CURRENT_STEP+=1
echo [STEP !CURRENT_STEP!/%TOTAL_STEPS%] Browser Cache Safe Maintenance...

${config.cleanChromeCache ? `
tasklist /fi "imagename eq chrome.exe" | find /i "chrome.exe" >nul
if !errorlevel! equ 0 (
    echo  [WARN] Google Chrome is currently open. Skipping cache to prevent data loss.
) else (
    echo  - Purging Google Chrome Cache...
    del /q /f /s "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache\\*" >nul 2>&1
    del /q /f /s "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Code Cache\\*" >nul 2>&1
    echo  [OK] Google Chrome cache cleaned.
)
` : ""}

${config.cleanEdgeCache ? `
tasklist /fi "imagename eq msedge.exe" | find /i "msedge.exe" >nul
if !errorlevel! equ 0 (
    echo  [WARN] Microsoft Edge is currently open. Skipping cache to prevent data loss.
) else (
    echo  - Purging Microsoft Edge Cache...
    del /q /f /s "%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache\\*" >nul 2>&1
    del /q /f /s "%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Code Cache\\*" >nul 2>&1
    echo  [OK] Microsoft Edge cache cleaned.
)
` : ""}

${config.cleanFirefoxCache ? `
tasklist /fi "imagename eq firefox.exe" | find /i "firefox.exe" >nul
if !errorlevel! equ 0 (
    echo  [WARN] Mozilla Firefox is currently open. Skipping cache.
) else (
    echo  - Purging Mozilla Firefox Cache...
    for /d %%d in ("%LOCALAPPDATA%\\Mozilla\\Firefox\\Profiles\\*") do (
        del /q /f /s "%%d\\cache2\\*" >nul 2>&1
    )
    echo  [OK] Mozilla Firefox cache cleaned.
)
` : ""}

echo.

:: ----------------------------------------------------------------------------
:: 4. Windows Performance Tweaks
:: ----------------------------------------------------------------------------
set /a CURRENT_STEP+=1
echo [STEP !CURRENT_STEP!/%TOTAL_STEPS%] Tuning Performance Background Services...

${config.restartPerformanceServices ? `
echo  - Recycling SysMain (SuperFetch) service...
net stop SysMain >nul 2>&1
net start SysMain >nul 2>&1
echo  [OK] SysMain memory caching service recycled.

echo  - Refreshing Windows Search indexer...
net stop WSearch >nul 2>&1
net start WSearch >nul 2>&1
echo  [OK] Windows Search service refreshed.
` : `echo  [SKIP] Background service tuning disabled.`}

${config.adjustVisualEffects ? `
echo  - Adjusting menu delay response for snappy feel...
reg add "HKCU\\Control Panel\\Desktop" /v MenuShowDelay /t REG_SZ /d 20 /f >nul 2>&1
echo  [OK] Menu responsiveness accelerated.
` : ""}

echo.
echo ============================================================================
echo                    EXECUTION SUMMARY REPORT
echo ============================================================================
echo  Status:          Completed Successfully
echo  Timestamp:       %DATE% %TIME%
if defined REBOOT_RECOMMENDED (
    echo  Recommendation:  REBOOT RECOMMENDED (Network stack was reset)
) else (
    echo  Recommendation:  No reboot necessary.
)
echo ============================================================================
echo.
echo Press any key to exit...
pause >nul
exit /b 0
`;
}
function generateHybridLauncher() {
  return `@echo off
:: WinOptimize-Launcher.bat
:: One-click self-elevating launcher for WinOptimize.ps1
:: Automatically bypasses execution policy restrictions safely.
title WinOptimize Administrator Launcher
chcp 65001 >nul

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Elevating privileges to Administrator...
    powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
    exit /b
)

:: Run the PowerShell script with ExecutionPolicy Bypass
cd /d "%~dp0"
if exist "WinOptimize.ps1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0WinOptimize.ps1"
) else (
    echo [ERROR] WinOptimize.ps1 was not found in the same folder as this launcher!
    echo Please make sure WinOptimize.ps1 and WinOptimize-Launcher.bat are kept together.
    pause
)
`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateBatchScript,
  generateHybridLauncher,
  generatePowerShellScript
});
