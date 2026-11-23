param([switch]$Manter)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$apceSource=Split-Path $PSScriptRoot -Parent
$apceEvidence=Join-Path $apceSource 'evidencias'
$apceClean=Join-Path $apceEvidence ('instalacao-limpa-'+[guid]::NewGuid().ToString('N'))
$apcePreviousPath=$env:PATH
$apcePreviousData=$env:APCE_STREAM_DATA_DIR
$apcePassed=$false
New-Item -ItemType Directory -Path $apceClean -Force | Out-Null
try {
    Push-Location $apceSource
    try { $apceFiles=@(git -c core.quotepath=false ls-files -co --exclude-standard | Select-Object -Unique) } finally { Pop-Location }
    foreach($apceFile in $apceFiles){
        $apceDestination=Join-Path $apceClean $apceFile
        New-Item -ItemType Directory -Path (Split-Path $apceDestination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $apceSource $apceFile) -Destination $apceDestination
    }
    $apceLock=Get-Content -LiteralPath (Join-Path $apceSource 'installer\dependencies.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $apceCache=Join-Path $apceClean 'downloads\installer'
    New-Item -ItemType Directory -Path $apceCache -Force | Out-Null
    foreach($apceProperty in $apceLock.packages.PSObject.Properties){
        $apcePackage=$apceProperty.Value
        $apceOriginal=Join-Path $apceSource ('downloads\installer\'+$apcePackage.file)
        if(!(Test-Path -LiteralPath $apceOriginal) -and $apcePackage.legacyCache){$apceOriginal=Join-Path $apceSource $apcePackage.legacyCache}
        if(Test-Path -LiteralPath $apceOriginal){
            $apceDestination=Join-Path $apceCache $apcePackage.file
            try{New-Item -ItemType HardLink -Path $apceDestination -Target $apceOriginal | Out-Null}catch{Copy-Item -LiteralPath $apceOriginal -Destination $apceDestination}
        }
    }
    # O ensaio não usa Node/Python/FFmpeg globais nem a autorização real do operador.
    $env:PATH=(Join-Path $env:WINDIR 'System32')+';'+$env:WINDIR+';'+$PSHOME
    $env:APCE_STREAM_DATA_DIR=Join-Path $apceClean 'user-data'
    $apceStdout=Join-Path $apceClean 'evidencias\installer-stdout.log'
    $apceStderr=Join-Path $apceClean 'evidencias\installer-stderr.log'
    New-Item -ItemType Directory -Path (Split-Path $apceStdout) -Force | Out-Null
    $apceChild=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $apceClean 'Instalar.ps1')+'" -SemAbrir') -WindowStyle Hidden -PassThru -RedirectStandardOutput $apceStdout -RedirectStandardError $apceStderr
    $null=$apceChild.Handle
    $apceChild.WaitForExit()
    if($apceChild.ExitCode -ne 0){
        Get-Content -LiteralPath $apceStdout -Tail 15
        Get-Content -LiteralPath $apceStderr -Tail 15
        throw 'O instalador falhou na pasta limpa.'
    }
    foreach($apceMarker in @('runtime\node\node.exe','runtime\python-env\Scripts\python.exe','runtime\ffmpeg\bin\ffmpeg.exe','runtime\ffmpeg\bin\ffprobe.exe','obs\bin\64bit\obs64.exe','obs\plugins\move-transition\move-transition.dll','obs\obs-plugins\64bit\obs-vdoninja.dll','private\studio.json','obs\config\obs-studio\basic\profiles\APCE_Painel\basic.ini')){
        if(!(Test-Path -LiteralPath (Join-Path $apceClean $apceMarker))){throw ('Componente ausente: '+$apceMarker)}
    }
    $apcePythonCheck=Start-Process -FilePath (Join-Path $apceClean 'runtime\python-env\Scripts\python.exe') -ArgumentList '-c "import PIL, pymupdf, pywinauto"' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $apceClean 'evidencias\python-stdout.log') -RedirectStandardError (Join-Path $apceClean 'evidencias\python-stderr.log')
    $null=$apcePythonCheck.Handle
    $apcePythonCheck.WaitForExit()
    if($apcePythonCheck.ExitCode -ne 0){throw 'As dependências Python não carregaram. Consulte evidencias/python-stderr.log na pasta do teste.'}
    $apceConfigCheck=Start-Process -FilePath (Join-Path $apceClean 'runtime\node\node.exe') -ArgumentList ('"'+(Join-Path $apceClean 'scripts\migrate-oauth.mjs')+'"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $apceClean 'evidencias\oauth-check.json') -RedirectStandardError (Join-Path $apceClean 'evidencias\oauth-stderr.log')
    $null=$apceConfigCheck.Handle
    $apceConfigCheck.WaitForExit()
    if($apceConfigCheck.ExitCode -ne 0){throw 'Falha ao verificar a configuração central.'}
    $apceCentral=Get-Content -LiteralPath (Join-Path $apceClean 'evidencias\oauth-check.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if(!$apceCentral.clientConfigured -or $apceCentral.connected){throw 'A instalação limpa não recebeu a identidade OAuth central ou reutilizou tokens do operador.'}
    $apceCollection=Get-Content -LiteralPath (Join-Path $apceClean 'obs\config\obs-studio\basic\scenes\APCE.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if(!$apceCollection.transitions.Count){throw 'A transição Move não foi registrada na coleção nova.'}
    $apcePassed=$true
    @{passed=$true;isolatedPath=$true;isolatedOAuth=$true;centralOAuth=$true;jsonImported=$false;includesPython=$true;includesOBS=$true;includesPlugins=$true;includesFFmpeg=$true;publicStreamStarted=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $apceEvidence 'instalacao-limpa.json') -Encoding UTF8
    Write-Host 'OK: instalação em pasta limpa, sem Node/Python/FFmpeg globais e sem copiar OAuth do operador.'
} finally {
    $env:PATH=$apcePreviousPath
    $env:APCE_STREAM_DATA_DIR=$apcePreviousData
    $apceResolved=[IO.Path]::GetFullPath($apceClean)
    $apcePrefix=[IO.Path]::GetFullPath($apceEvidence).TrimEnd('\')+'\'
    if($apcePassed -and !$Manter -and $apceResolved.StartsWith($apcePrefix,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($apceResolved).StartsWith('instalacao-limpa-')){Remove-Item -LiteralPath $apceResolved -Recurse -Force}
}
