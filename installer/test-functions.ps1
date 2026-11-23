$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$apceRoot=Join-Path ([IO.Path]::GetTempPath()) ('apce-installer-test-'+[guid]::NewGuid().ToString('N'))
$apceCache=Join-Path $apceRoot 'cache'
New-Item -ItemType Directory -Path $apceCache -Force | Out-Null
. (Join-Path $PSScriptRoot 'functions.ps1')
$apceTests=0
function Assert-True([bool]$Value,[string]$Message){if(!$Value){throw $Message}}
function Assert-Fails([scriptblock]$Action){$apceFailed=$false;try{& $Action}catch{$apceFailed=$true};Assert-True $apceFailed 'A operação deveria ter sido recusada.'}
try {
    Assert-Fails { Assert-InRoot (Join-Path ([IO.Path]::GetTempPath()) 'outside-apce.txt') }
    $apceTests++
    $apceMalicious=Join-Path $apceCache 'malicious.zip'
    $apceZip=[IO.Compression.ZipFile]::Open($apceMalicious,[IO.Compression.ZipArchiveMode]::Create)
    try{$apceZip.CreateEntry('../escape.txt') | Out-Null}finally{$apceZip.Dispose()}
    Assert-Fails { Expand-APCEArchive $apceMalicious 'unsafe' }
    Assert-True (!(Test-Path -LiteralPath (Join-Path $apceRoot 'escape.txt'))) 'Um arquivo escapou da extração.'
    $apceTests++
    $apceArchive=Join-Path $apceCache 'valid.zip'
    $apceZip=[IO.Compression.ZipFile]::Open($apceArchive,[IO.Compression.ZipArchiveMode]::Create)
    try{
        $apceEntry=$apceZip.CreateEntry('package/hello.txt');$apceWriter=[IO.StreamWriter]::new($apceEntry.Open());$apceWriter.Write('APCE');$apceWriter.Dispose()
    }finally{$apceZip.Dispose()}
    $apceLock=[pscustomobject]@{packages=[pscustomobject]@{sample=[pscustomobject]@{version='test';file='valid.zip';url='https://example.invalid/package.zip';sha256=(Get-FileHash -LiteralPath $apceArchive -Algorithm SHA256).Hash}}}
    $apceResolved=Get-APCEArchive 'sample';Assert-True ($apceResolved -eq $apceArchive) 'Não reutilizou o pacote validado.'
    $apceStage=Expand-APCEArchive $apceResolved 'safe';Assert-True ((Get-Content -LiteralPath (Join-Path $apceStage 'package/hello.txt')) -eq 'APCE') 'Falha ao extrair o pacote válido.'
    $apceTests++
    $apceMarker=Join-Path $apceRoot 'installed/tool.exe';New-Item -ItemType Directory -Path (Split-Path $apceMarker) -Force | Out-Null
    [IO.File]::WriteAllText($apceMarker,'existing')
    Install-APCEPortable 'sample' $apceMarker (Split-Path $apceMarker) 'tool.exe'
    Assert-True ((Get-Content -LiteralPath $apceMarker) -eq 'existing') 'A reinstalação substituiu o componente existente.'
    $apceTests++
    function Invoke-WebRequest { param($Uri,$OutFile,$TimeoutSec,[switch]$UseBasicParsing) [IO.File]::WriteAllText($OutFile,'tampered') }
    $apceLock.packages.sample.file='invalid.zip';$apceLock.packages.sample.sha256='0'*64
    Assert-Fails { Get-APCEArchive 'sample' }
    Assert-True (!(Test-Path -LiteralPath (Join-Path $apceCache 'invalid.zip'))) 'Um pacote inválido foi aprovado.'
    $apceTests++
    # Exercita o caminho de instalação do Visual C++ sem executar um instalador real.
    function Test-Path { param([string]$LiteralPath) if($LiteralPath -match '(msvcp140|vcruntime140|vcruntime140_1)\.dll$'){return $false};Microsoft.PowerShell.Management\Test-Path -LiteralPath $LiteralPath }
    $apceSignatureStatus='Valid';$apceFakeExit=0;$script:apceStarts=0
    function Get-AuthenticodeSignature { param($LiteralPath) [pscustomobject]@{Status=$apceSignatureStatus;SignerCertificate=[pscustomobject]@{Subject='CN=Microsoft Corporation, O=Microsoft Corporation'}} }
    function Start-Process {
        param($FilePath,$ArgumentList,$Verb,$WindowStyle,[switch]$PassThru)
        Assert-True ($Verb -eq 'RunAs' -and $WindowStyle -eq 'Hidden') 'O runtime exige elevação explícita do Windows.'
        $script:apceStarts++
        $apceMock=[pscustomobject]@{Handle=1;ExitCode=$apceFakeExit}
        $apceMock | Add-Member -MemberType ScriptMethod -Name WaitForExit -Value {}
        return $apceMock
    }
    foreach($apceCode in @(0,3010)){$apceFakeExit=$apceCode;Ensure-APCECppRuntime}
    $apceTests++
    $apceFakeExit=1;Assert-Fails {Ensure-APCECppRuntime};$apceTests++
    $apceSignatureStatus='NotTrusted';$apceStartsBefore=$script:apceStarts
    Assert-Fails {Ensure-APCECppRuntime};Assert-True ($script:apceStarts -eq $apceStartsBefore) 'Um instalador sem assinatura válida foi executado.'
    $apceTests++
    Write-Host ('OK: '+$apceTests+' verificações do instalador.')
} finally {
    $apceResolved=[IO.Path]::GetFullPath($apceRoot)
    $apceTempPrefix=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
    if($apceResolved.StartsWith($apceTempPrefix,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($apceResolved).StartsWith('apce-installer-test-')) { Remove-Item -LiteralPath $apceResolved -Recurse -Force }
}
