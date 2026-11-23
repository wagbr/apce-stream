param([switch]$SemAbrirNavegador)
$ErrorActionPreference = 'Stop'
$studioPath = $PSScriptRoot
. (Join-Path $studioPath 'scripts\runtime.ps1')
Enable-APCERuntime $studioPath
$panelUrl = 'http://127.0.0.1:3210'

function Test-PainelAPCE {
    try {
        $state = Invoke-RestMethod ($panelUrl + '/api/health') -TimeoutSec 2
        return ($state.ok -and $state.app -eq 'APCE Studio')
    } catch { return $false }
}

$panelMutex = [System.Threading.Mutex]::new($false, 'Local\APCE_Painel_3210')
$lockAcquired = $false
try {
    $lockAcquired = $panelMutex.WaitOne(15000)
    if (-not $lockAcquired) { throw 'O painel já está sendo iniciado. Tente novamente em alguns segundos.' }
    if (-not (Test-PainelAPCE)) {
        $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
        Start-Process -FilePath $nodePath -ArgumentList ('"' + (Join-Path $studioPath 'server.mjs') + '"') -WorkingDirectory $studioPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $studioPath 'server.log') -RedirectStandardError (Join-Path $studioPath 'server-error.log')
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        do {
            Start-Sleep -Milliseconds 250
            $ready = Test-PainelAPCE
        } until ($ready -or [DateTime]::UtcNow -ge $deadline)
        if (-not $ready) { throw 'O painel não respondeu. Consulte server-error.log na pasta Estudio APCE.' }
    }
} finally {
    if ($lockAcquired) { $panelMutex.ReleaseMutex() }
    $panelMutex.Dispose()
}
if (-not $SemAbrirNavegador) {
    . (Join-Path $studioPath 'scripts\open-browser.ps1')
    Open-APCEBrowser $panelUrl
}
