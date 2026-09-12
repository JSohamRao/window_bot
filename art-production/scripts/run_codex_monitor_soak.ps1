param(
  [ValidateRange(1, 120)]
  [int]$DurationMinutes = 15,

  [ValidateRange(5, 300)]
  [int]$SampleSeconds = 30,

  [Parameter(Mandatory = $true)]
  [int]$TargetSessionId,

  [string]$OutputPath = (Join-Path $PSScriptRoot "..\..\phase115-codex-monitor-soak.csv")
)

$ErrorActionPreference = "Stop"
$electronPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..\node_modules\electron\dist\electron.exe")).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$expectedOutput = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "phase115-codex-monitor-soak.csv"))

if ($resolvedOutput -ne $expectedOutput) {
  throw "Refusing unexpected output path: $resolvedOutput"
}

if (Test-Path -LiteralPath $resolvedOutput) {
  throw "Refusing to overwrite existing monitor CSV: $resolvedOutput"
}

$initialSessionProcesses = @(
  Get-Process electron -ErrorAction SilentlyContinue |
    Where-Object { $_.SessionId -eq $TargetSessionId }
)

$exactPathMatches = @(
  $initialSessionProcesses |
    Where-Object {
      try { $_.Path -eq $electronPath } catch { $false }
    }
)

if ($exactPathMatches.Count -eq 0) {
  throw "No Electron process in session $TargetSessionId exposes the THUKUNA Electron path."
}

$initialPids = @($initialSessionProcesses.Id | Sort-Object)
$sampleCount = [math]::Ceiling(($DurationMinutes * 60) / $SampleSeconds)

"Time,PID,CPUSeconds,WorkingSetMB,PrivateMemoryMB,ProcessCount,SessionId,StartTime,InitialPID,PathMatch,AccessStatus" |
  Set-Content -LiteralPath $resolvedOutput -Encoding utf8

for ($sampleIndex = 0; $sampleIndex -lt $sampleCount; $sampleIndex += 1) {
  $sampleTime = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK")
  $processes = @(
    Get-Process electron -ErrorAction SilentlyContinue |
      Where-Object { $_.SessionId -eq $TargetSessionId } |
      Sort-Object Id
  )
  $processCount = $processes.Count

  if ($processCount -eq 0) {
    "$sampleTime,,,,,0,$TargetSessionId,,,UNKNOWN,NO_PROCESS" |
      Add-Content -LiteralPath $resolvedOutput -Encoding utf8
  } else {
    foreach ($process in $processes) {
      $cpu = $null
      $workingSet = $null
      $privateMemory = $null
      $startTime = ""
      $pathMatch = "UNKNOWN"
      $accessStatus = "FULL"

      try { $cpu = $process.CPU } catch { $accessStatus = "PARTIAL" }
      try { $workingSet = $process.WorkingSet64 / 1MB } catch { $accessStatus = "PARTIAL" }
      try { $privateMemory = $process.PrivateMemorySize64 / 1MB } catch { $accessStatus = "PARTIAL" }
      try { $startTime = $process.StartTime.ToString("yyyy-MM-ddTHH:mm:ss.fffK") } catch { $accessStatus = "PARTIAL" }
      try {
        $processPath = $process.Path
        if ([string]::IsNullOrEmpty($processPath)) {
          $pathMatch = "UNKNOWN"
          $accessStatus = "PARTIAL"
        } else {
          $pathMatch = if ($processPath -eq $electronPath) { "YES" } else { "NO" }
        }
      } catch {
        $accessStatus = "PARTIAL"
      }

      if ($null -eq $cpu) { $accessStatus = "PARTIAL" }
      if ($null -eq $workingSet) { $accessStatus = "PARTIAL" }
      if ($null -eq $privateMemory) { $accessStatus = "PARTIAL" }

      $cpuText = if ($null -eq $cpu) { "" } else { [math]::Round($cpu, 4) }
      $workingSetText = if ($null -eq $workingSet) { "" } else { [math]::Round($workingSet, 2) }
      $privateMemoryText = if ($null -eq $privateMemory) { "" } else { [math]::Round($privateMemory, 2) }
      $initialPid = if ($initialPids -contains $process.Id) { "YES" } else { "NO" }

      @(
        $sampleTime,
        $process.Id,
        $cpuText,
        $workingSetText,
        $privateMemoryText,
        $processCount,
        $TargetSessionId,
        $startTime,
        $initialPid,
        $pathMatch,
        $accessStatus
      ) -join "," | Add-Content -LiteralPath $resolvedOutput -Encoding utf8
    }
  }

  $pidText = if ($processCount -eq 0) { "none" } else { ($processes.Id -join ",") }
  Write-Output (
    "SAMPLE {0}/{1} TIME={2} PROCESS_COUNT={3} PIDS={4}" -f
      ($sampleIndex + 1), $sampleCount, $sampleTime, $processCount, $pidText
  )

  if ($sampleIndex -lt $sampleCount - 1) {
    Start-Sleep -Seconds $SampleSeconds
  }
}

Write-Output "MONITOR_COMPLETE=$resolvedOutput"
