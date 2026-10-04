$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $ws.CreateShortcut((Join-Path $desktop "StreamPulse MultiChat.lnk"))
$shortcut.TargetPath = Join-Path $PSScriptRoot "dist\StreamPulse MultiChat-win32-x64\StreamPulse MultiChat.exe"
$shortcut.WorkingDirectory = Join-Path $PSScriptRoot "dist\StreamPulse MultiChat-win32-x64"
$shortcut.IconLocation = Join-Path $PSScriptRoot "public\icons\icon-512.png"
$shortcut.Save()
Write-Host "Shortcut StreamPulse MultiChat berhasil dibuat di Desktop!" -ForegroundColor Green
