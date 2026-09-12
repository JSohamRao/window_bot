param(
  [string]$ExecutablePath = "$env:LOCALAPPDATA\Programs\THUKUNA\THUKUNA.exe",
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\phase12-packaged-soak.csv"),
  [ValidateRange(1, 1440)]
  [int]$DurationMinutes = 15,
  [ValidateRange(5, 300)]
  [int]$IntervalSeconds = 30
)

$resolvedExecutable = [IO.Path]::GetFullPath($ExecutablePath)
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)

if (-not (Test-Path -LiteralPath $resolvedExecutable -PathType Leaf)) {
  throw "Installed THUKUNA executable not found: $resolvedExecutable"
}
if (Test-Path -LiteralPath $resolvedOutput) {
  throw "Refusing to overwrite existing soak evidence: $resolvedOutput"
}

$deadline = [DateTimeOffset]::Now.AddMinutes($DurationMinutes)
$startedAt = [DateTimeOffset]::Now
$samples = [Collections.Generic.List[object]]::new()

do {
  $processes = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    try { $_.Path -eq $resolvedExecutable } catch { $false }
  })
  $samples.Add([pscustomobject]@{
    Timestamp = [DateTimeOffset]::Now.ToString("o")
    ElapsedSeconds = [Math]::Round(([DateTimeOffset]::Now - $startedAt).TotalSeconds, 1)
    PIDs = ($processes.Id -join ";")
    ProcessCount = $processes.Count
    CPUSeconds = [Math]::Round((($processes | Measure-Object CPU -Sum).Sum), 3)
    WorkingSetMB = [Math]::Round((($processes | Measure-Object WorkingSet64 -Sum).Sum / 1MB), 2)
    PrivateMemoryMB = [Math]::Round((($processes | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB), 2)
  })
  if ([DateTimeOffset]::Now -lt $deadline) {
    Start-Sleep -Seconds $IntervalSeconds
  }
} while ([DateTimeOffset]::Now -lt $deadline)

$samples | Export-Csv -LiteralPath $resolvedOutput -NoTypeInformation -Encoding UTF8
Write-Output "Saved $($samples.Count) samples to $resolvedOutput"
