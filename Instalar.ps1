param(
    [switch]$Verificar,
    [switch]$SemAbrir
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$apceRoot = $PSScriptRoot
$apceLock = Get-Content -LiteralPath (Join-Path $apceRoot 'installer\dependencies.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$apceRuntime = Join-Path $apceRoot 'runtime'
$apceCache = Join-Path $apceRoot 'downloads\installer'
$apceConfig = Join-Path $apceRoot 'private\studio.json'
$apceFresh = !(Test-Path -LiteralPath $apceConfig)
$apceRestartServer = $false
$apceExistingService = $false
try {
    $apceHealth = Invoke-RestMethod 'http://127.0.0.1:3210/api/health' -TimeoutSec 2
    if ($apceHealth.app -eq 'APCE Studio') {
        $apceExistingService = $true
        $apceLiveState = Invoke-RestMethod 'http://127.0.0.1:3210/api/state' -TimeoutSec 5
        if ($apceLiveState.streaming -or $apceLiveState.recording) { throw 'Encerre a transmissão e a gravação antes de executar o instalador.' }
    }
} catch {
    if ($apceExistingService) { throw }
}

. (Join-Path $apceRoot 'installer\functions.ps1')

if (![Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Esta instalação requer Windows x64.' }
if ($Verificar) {
    [pscustomobject]@{
        Node = Test-Path -LiteralPath (Join-Path $apceRuntime 'node\node.exe')
        Python = Test-Path -LiteralPath (Join-Path $apceRuntime 'python-env\Scripts\python.exe')
        FFmpeg = Test-Path -LiteralPath (Join-Path $apceRuntime 'ffmpeg\bin\ffmpeg.exe')
        OBS = Test-Path -LiteralPath (Join-Path $apceRoot 'obs\bin\64bit\obs64.exe')
        Move = Test-Path -LiteralPath (Join-Path $apceRoot 'obs\plugins\move-transition\move-transition.dll')
        VDONinja = Test-Path -LiteralPath (Join-Path $apceRoot 'obs\obs-plugins\64bit\obs-vdoninja.dll')
        Configuracao = Test-Path -LiteralPath $apceConfig
    } | Format-List
    return
}
$apceMutex = [Threading.Mutex]::new($false,'Local\APCE_Stream_Installer')
$apceAcquired = $false
try {
    $apceAcquired = $apceMutex.WaitOne(0)
    if (!$apceAcquired) { throw 'Outra instalação do APCE Stream está em andamento.' }
    New-Item -ItemType Directory -Path $apceCache,$apceRuntime -Force | Out-Null
    Ensure-APCECppRuntime
    $apceNode = Join-Path $apceRuntime 'node\node.exe'
    $apceUv = Join-Path $apceRuntime 'uv\uv.exe'
    Install-APCEPortable 'node' $apceNode (Join-Path $apceRuntime 'node') 'node.exe'
    Install-APCEPortable 'uv' $apceUv (Join-Path $apceRuntime 'uv') 'uv.exe'
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $apceRuntime 'python'
    $env:UV_CACHE_DIR = Join-Path $apceCache 'uv-cache'
    $env:UV_NO_CONFIG = '1'
    Write-Step ('Preparando Python ' + $apceLock.pythonVersion + ' isolado da instalação do Windows…')
    Invoke-Checked $apceUv @('python','install',[string]$apceLock.pythonVersion,'--no-bin','--no-progress')
    $apcePython = Join-Path $apceRuntime 'python-env\Scripts\python.exe'
    if (!(Test-Path -LiteralPath $apcePython)) { Invoke-Checked $apceUv @('venv','--managed-python','--python',[string]$apceLock.pythonVersion,(Join-Path $apceRuntime 'python-env')) }
    Invoke-Checked $apceUv @('pip','install','--python',$apcePython,'--requirement',(Join-Path $apceRoot 'requirements.txt'),'--no-progress')
    Install-APCEPortable 'ffmpeg' (Join-Path $apceRuntime 'ffmpeg\bin\ffmpeg.exe') (Join-Path $apceRuntime 'ffmpeg') 'ffmpeg.exe'
    $apceObs = Join-Path $apceRoot 'obs'
    Install-APCEPortable 'obs' (Join-Path $apceObs 'bin\64bit\obs64.exe') $apceObs ''
    if (!(Test-Path -LiteralPath (Join-Path $apceObs 'plugins\move-transition\move-transition.dll'))) {
        $apceStage = Expand-APCEArchive (Get-APCEArchive 'move') 'move'
        Copy-APCETree (Join-Path $apceStage 'plugins') (Join-Path $apceObs 'plugins')
    }
    if (!(Test-Path -LiteralPath (Join-Path $apceObs 'obs-plugins\64bit\obs-vdoninja.dll'))) {
        $apceStage = Expand-APCEArchive (Get-APCEArchive 'ninja') 'ninja'
        foreach ($apceFolder in @('obs-plugins','data')) { Copy-APCETree (Join-Path $apceStage $apceFolder) (Join-Path $apceObs $apceFolder) }
    }
    . (Join-Path $apceRoot 'scripts\runtime.ps1')
    Enable-APCERuntime $apceRoot
    Push-Location $apceRoot
    try {
        Write-Step 'Instalando as dependências da aplicação…'
        if ($apceExistingService) {
            $apceSha = [Security.Cryptography.SHA256]::Create()
            try { $apceIdentity = ([BitConverter]::ToString($apceSha.ComputeHash([Text.Encoding]::UTF8.GetBytes($apceRoot.ToLowerInvariant())))).Replace('-','').ToLowerInvariant().Substring(0,16) } finally { $apceSha.Dispose() }
            if ($apceHealth.instance -eq $apceIdentity) {
                $apceListener = Get-NetTCPConnection -State Listen -LocalPort 3210 | Select-Object -First 1
                $apceServiceProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($apceListener.OwningProcess)"
                if ($apceServiceProcess.Name -eq 'node.exe' -and $apceServiceProcess.CommandLine -match [regex]::Escape((Join-Path $apceRoot 'server.mjs'))) {
                    Stop-Process -Id $apceServiceProcess.ProcessId
                    $apceRestartServer = $true
                }
            } elseif ($apceFresh -and !$SemAbrir) { throw 'Já existe outro APCE Stream aberto. Feche a instância anterior antes de concluir a nova instalação.' }
        }
        $apceNpmArgs = @('ci','--no-audit','--no-fund')
        if (!(Test-Path -LiteralPath (Join-Path $apceRoot 'node_modules\playwright\package.json'))) { $apceNpmArgs += '--omit=dev' }
        Invoke-Checked (Join-Path $apceRuntime 'node\npm.cmd') $apceNpmArgs
        if ($apceFresh -or !(Test-Path -LiteralPath (Join-Path $apceObs 'config\obs-studio\basic\profiles\APCE_Painel\basic.ini'))) { Invoke-Checked $apcePython @('scripts/preparar.py') }
        Write-Step 'Preservando a conexão Google neste usuário do Windows…'
        $apceOAuthResult = & $apceNode 'scripts/migrate-oauth.mjs'
        if ($LASTEXITCODE -ne 0) { throw 'Não foi possível conferir o armazenamento protegido do Google.' }
        $apceOAuthState = $apceOAuthResult | ConvertFrom-Json
        if ($apceOAuthState.connected) { Write-Step 'Canal já conectado; configuração Google preservada.' }
        else { Write-Step 'Use Agenda → Conectar YouTube para autorizar o canal.' }
    } finally { Pop-Location }
    @{completed=[DateTime]::UtcNow.ToString('o');packages=$apceLock;python=$apceLock.pythonVersion} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $apceRuntime 'installed.json') -Encoding UTF8
    Write-Step 'Instalação concluída. Reinstalações preservam a configuração Google deste usuário.'
    if (!$SemAbrir) {
        & (Join-Path $apceRoot 'Iniciar estudio.ps1')
        $apceRestartServer = $false
        if ($apceFresh) {
            $apceReady = $false
            for ($apceAttempt=0; $apceAttempt -lt 45; $apceAttempt++) {
                try { $apceState = Invoke-RestMethod 'http://127.0.0.1:3210/api/state' -TimeoutSec 3; if ($apceState.connected) { $apceReady=$true; break } } catch {}
                Start-Sleep -Milliseconds 1000
            }
            if ($apceReady) {
                Invoke-RestMethod 'http://127.0.0.1:3210/api/action' -Method Post -Headers @{Origin='http://127.0.0.1:3210'} -ContentType 'application/json' -Body '{"action":"setup"}' | Out-Null
                Write-Step 'Cenas e controles do OBS configurados.'
            } else { Write-Step 'O OBS ainda está iniciando. Quando conectar, use Configurações → Reparar cenas.' }
        }
    }
} finally {
    if ($apceRestartServer) {
        try { & (Join-Path $apceRoot 'Abrir painel.ps1') -SemAbrirNavegador }
        catch { Write-Warning 'O painel não reiniciou. Confira server-error.log e execute Abrir Painel APCE.cmd após corrigir a instalação.' }
    }
    if ($apceAcquired) { $apceMutex.ReleaseMutex() }
    $apceMutex.Dispose()
}
