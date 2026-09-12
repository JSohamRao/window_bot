param(
  [ValidateRange(15, 120)]
  [int]$DurationMinutes = 30,

  [ValidateRange(5, 300)]
  [int]$SampleSeconds = 30,

  [string]$OutputPath = (Join-Path $PSScriptRoot "phase115-final-soak.csv")
)

$electronPath = (Resolve-Path (Join-Path $PSScriptRoot "node_modules\electron\dist\electron.exe")).Path
$sampleCount = [math]::Ceiling(($DurationMinutes * 60) / $SampleSeconds)

"Time,PID,Process,CPUSeconds,WorkingSetMB,PrivateMemoryMB" |
  Set-Content -LiteralPath $OutputPath -Encoding utf8

for ($sampleIndex = 0; $sampleIndex -lt $sampleCount; $sampleIndex += 1) {
  Get-Process electron -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $electronPath } |
    ForEach-Object {
      $values = @(
        (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffK"),
        $_.Id,
        $_.ProcessName,
        [math]::Round($_.CPU, 2),
        [math]::Round($_.WorkingSet64 / 1MB, 2),
        [math]::Round($_.PrivateMemorySize64 / 1MB, 2)
      )
      $values -join "," | Add-Content -LiteralPath $OutputPath -Encoding utf8
    }

  if ($sampleIndex -lt $sampleCount - 1) {
    Start-Sleep -Seconds $SampleSeconds
  }
}

Write-Host "Phase 11.5 final $DurationMinutes-minute soak completed: $OutputPath"

