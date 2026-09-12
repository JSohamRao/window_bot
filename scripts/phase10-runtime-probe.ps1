param(
  [Parameter(Mandatory = $true)]
  [string]$Expression,
  [int]$Port = 9222
)

$probeTarget = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" |
  Where-Object { $_.title -eq "THUKUNA" } |
  Select-Object -First 1

if ($null -eq $probeTarget) {
  throw "THUKUNA diagnostic target was not found."
}

$probeSocket = [System.Net.WebSockets.ClientWebSocket]::new()
$probeCancellation = [System.Threading.CancellationToken]::None
$null = $probeSocket.ConnectAsync(
  [Uri]$probeTarget.webSocketDebuggerUrl,
  $probeCancellation
).GetAwaiter().GetResult()

function Invoke-ThukunaCdp {
  param(
    [Parameter(Mandatory = $true)]
    [int]$RequestId,
    [Parameter(Mandatory = $true)]
    [string]$Method,
    [hashtable]$Parameters = @{}
  )

  $probeRequest = @{
    id = $RequestId
    method = $Method
    params = $Parameters
  } | ConvertTo-Json -Depth 12 -Compress
  $probeBytes = [Text.Encoding]::UTF8.GetBytes($probeRequest)
  $null = $probeSocket.SendAsync(
    [ArraySegment[byte]]::new($probeBytes),
    [System.Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    $probeCancellation
  ).GetAwaiter().GetResult()

  while ($true) {
    $probeStream = [IO.MemoryStream]::new()
    do {
      $probeBuffer = [byte[]]::new(65536)
      $probeResult = $probeSocket.ReceiveAsync(
        [ArraySegment[byte]]::new($probeBuffer),
        $probeCancellation
      ).GetAwaiter().GetResult()
      $probeStream.Write($probeBuffer, 0, $probeResult.Count)
    } while (-not $probeResult.EndOfMessage)

    $probeMessage = [Text.Encoding]::UTF8.GetString($probeStream.ToArray()) |
      ConvertFrom-Json -Depth 20
    if ($probeMessage.id -eq $RequestId) {
      return $probeMessage
    }
  }
}

$probeResponse = Invoke-ThukunaCdp -RequestId 1 -Method "Runtime.evaluate" -Parameters @{
  expression = $Expression
  awaitPromise = $true
  returnByValue = $true
}

if ($null -ne $probeResponse.error) {
  throw ($probeResponse.error | ConvertTo-Json -Depth 10)
}
if ($null -ne $probeResponse.result.exceptionDetails) {
  throw ($probeResponse.result.exceptionDetails | ConvertTo-Json -Depth 10)
}

$probeResponse.result.result.value
$probeSocket.Dispose()
