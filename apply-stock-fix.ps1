# JPRIME stock fix - copies each file to the same path inside your project.
# HOW TO RUN: open PowerShell IN YOUR PROJECT FOLDER (where package.json is), then run:
#   powershell -ExecutionPolicy Bypass -File "C:\path\to\stock-fix\apply-stock-fix.ps1"
# Your old versions are saved OUTSIDE the project (next to it) in a "stock-fix-backup-..." folder.

$ErrorActionPreference = "Stop"
$project = (Get-Location).Path
$source  = $PSScriptRoot

if (-not (Test-Path (Join-Path $project "package.json"))) {
  throw "Run this from your project folder (the one that contains package.json)."
}
if ($project -eq $source -or $source.StartsWith($project + "\")) {
  throw "Keep the stock-fix folder OUTSIDE the project folder (for example in Downloads), then run again."
}

$backup = Join-Path (Split-Path $project -Parent) ("stock-fix-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$skip = @("jprime-stock-fix.patch", "apply-stock-fix.ps1", "package.json")

Get-ChildItem $source -Recurse -File | Where-Object { $skip -notcontains $_.Name -or $_.DirectoryName -ne $source } | ForEach-Object {
  $rel  = $_.FullName.Substring($source.Length + 1)
  $dest = Join-Path $project $rel

  if (Test-Path $dest) {
    $bak = Join-Path $backup $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $bak -Parent) | Out-Null
    Copy-Item $dest $bak -Force
    $status = "REPLACED"
  } else {
    $status = "NEW     "
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
  Copy-Item $_.FullName $dest -Force
  Write-Host "$status  $rel"
}

Write-Host ""
Write-Host "Done. Old versions saved in: $backup"
Write-Host "package.json was NOT changed. Add the test:logic line by hand (see instructions)."
