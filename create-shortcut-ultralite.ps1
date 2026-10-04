$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $ws.CreateShortcut((Join-Path $desktop "StreamPulse MultiChat (Ultra-Lite).lnk"))
$shortcut.TargetPath = Join-Path $PSScriptRoot "StreamPulse-UltraLite.exe"
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = Join-Path $PSScriptRoot "public\icons\icon-512.png"
$shortcut.WindowStyle = 7 # Minimized
$shortcut.Save()
Write-Host "Shortcut StreamPulse MultiChat (Ultra-Lite) berhasil dibuat di Desktop!" -ForegroundColor Green
