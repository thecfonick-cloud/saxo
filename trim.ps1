$lines = Get-Content 'public\join.html'
$trimmed = $lines | Select-Object -First 566
$trimmed | Set-Content 'public\join.html' -Encoding UTF8
Write-Host "Done. Lines now:" (Get-Content 'public\join.html').Count
