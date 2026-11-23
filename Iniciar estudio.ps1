$ErrorActionPreference = 'Stop'
$studioPath = $PSScriptRoot
& (Join-Path $studioPath 'Abrir painel.ps1') -SemAbrirNavegador
$obsPath = Join-Path $studioPath 'obs\bin\64bit\obs64.exe'
$running = Get-Process obs64 -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $obsPath }
if (-not $running) {
    Start-Process -FilePath $obsPath -ArgumentList '--portable','--profile','"APCE Painel"','--collection','APCE','--disable-updater' -WorkingDirectory (Join-Path $studioPath 'obs\bin\64bit')
}
. (Join-Path $studioPath 'scripts\open-browser.ps1')
Open-APCEBrowser 'http://127.0.0.1:3210'
