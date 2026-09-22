param([string]$LogPath, [int]$TimeoutSec = 75)
$ErrorActionPreference = 'Stop'
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$url = $null
while ((Get-Date) -lt $deadline) {
  if (Test-Path $LogPath) {
    $m = Select-String -Path $LogPath -Pattern 'https://[A-Za-z0-9.-]+\.cpolar\.(cn|io|top)' -AllMatches
    if ($m) { $url = ($m | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1); break }
  }
  Start-Sleep -Seconds 2
}
if (-not $url) { Write-Host '  [WARN] no tunnel url found in log'; exit 1 }
try {
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
  if ($r.StatusCode -ne 200) { Write-Host "  [WARN] url responded $($r.StatusCode)"; exit 1 }
} catch { Write-Host "  [WARN] url verify failed: $($_.Exception.Message)"; exit 1 }
Set-Clipboard $url
$desktop = [Environment]::GetFolderPath('Desktop')
Set-Content -Path (Join-Path $desktop 'sgs-url.txt') -Value $url -Encoding UTF8
Write-Host ''
Write-Host '  ============================================'
Write-Host "   URL: $url"
Write-Host '  ============================================'
exit 0
