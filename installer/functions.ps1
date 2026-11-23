function Write-Step([string]$Message) { Write-Host ('[APCE] ' + $Message) }
function Assert-InRoot([string]$Path) {
    $apceResolved = [IO.Path]::GetFullPath($Path)
    $apcePrefix = [IO.Path]::GetFullPath($apceRoot).TrimEnd('\') + '\'
    if (!$apceResolved.StartsWith($apcePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'O destino saiu da pasta da aplicação.' }
    return $apceResolved
}
function Invoke-Checked([string]$Executable,[string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw ('Falha ao executar ' + [IO.Path]::GetFileName($Executable) + ' (código ' + $LASTEXITCODE + ').') }
}
function Get-APCEArchive([string]$Name) {
    $apcePackage = $apceLock.packages.$Name
    $apceFile = Assert-InRoot (Join-Path $apceCache $apcePackage.file)
    $apceCandidates = @($apceFile)
    if ($apcePackage.legacyCache) { $apceCandidates += (Join-Path $apceRoot $apcePackage.legacyCache) }
    foreach ($apceCandidate in $apceCandidates) {
        if ((Test-Path -LiteralPath $apceCandidate) -and ((Get-FileHash -LiteralPath $apceCandidate -Algorithm SHA256).Hash -ieq $apcePackage.sha256)) { return $apceCandidate }
    }
    Write-Step ('Baixando ' + $Name + ' ' + $apcePackage.version + '…')
    Invoke-WebRequest -UseBasicParsing -Uri $apcePackage.url -OutFile ($apceFile + '.part') -TimeoutSec 900
    if ((Get-FileHash -LiteralPath ($apceFile + '.part') -Algorithm SHA256).Hash -ine $apcePackage.sha256) { throw ('SHA-256 inválido para ' + $Name + '. O pacote não será executado.') }
    Move-Item -LiteralPath ($apceFile + '.part') -Destination $apceFile -Force
    return $apceFile
}
function Expand-APCEArchive([string]$Archive,[string]$Name) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $apceStage = Assert-InRoot (Join-Path $apceCache ($Name + '-stage-' + [guid]::NewGuid().ToString('N')))
    $apcePrefix = $apceStage.TrimEnd('\') + '\'
    $apceZip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        foreach ($apceEntry in $apceZip.Entries) {
            $apceEntryPath = [IO.Path]::GetFullPath((Join-Path $apceStage $apceEntry.FullName))
            if (!$apceEntryPath.StartsWith($apcePrefix,[StringComparison]::OrdinalIgnoreCase) -or $apceEntry.FullName.Contains(':')) { throw 'O pacote contém um caminho inválido.' }
        }
    } finally { $apceZip.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($Archive,$apceStage)
    return $apceStage
}
function Copy-APCETree([string]$Source,[string]$Target) {
    $apceTarget = Assert-InRoot $Target
    New-Item -ItemType Directory -Path $apceTarget -Force | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $apceTarget -Recurse -Force
}
function Install-APCEPortable([string]$Name,[string]$Marker,[string]$Destination,[string]$Locator) {
    if (Test-Path -LiteralPath $Marker -PathType Leaf) { Write-Step ($Name + ' já está disponível.'); return }
    $apceStage = Expand-APCEArchive (Get-APCEArchive $Name) $Name
    if ($Locator) {
        $apceFound = @(Get-ChildItem -LiteralPath $apceStage -Recurse -File -Filter $Locator)
        if ($apceFound.Count -ne 1) { throw ('Estrutura inesperada no pacote ' + $Name + '.') }
        $apceSource = $apceFound[0].Directory.FullName
        if ($Name -eq 'ffmpeg') { $apceSource = $apceFound[0].Directory.Parent.FullName }
    } else { $apceSource = $apceStage }
    Copy-APCETree $apceSource $Destination
    if (!(Test-Path -LiteralPath $Marker)) { throw ('A instalação de ' + $Name + ' ficou incompleta.') }
}
function Ensure-APCECppRuntime {
    $apceDlls = @('msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll')
    $apceMissing = @($apceDlls | Where-Object { !(Test-Path -LiteralPath (Join-Path $env:WINDIR ('System32\' + $_))) })
    if (!$apceMissing.Count) { Write-Step 'Runtime Visual C++ disponível.'; return }
    $apceRedist = Assert-InRoot (Join-Path $apceCache 'vc_redist.x64.exe')
    Invoke-WebRequest -UseBasicParsing 'https://aka.ms/vc14/vc_redist.x64.exe' -OutFile $apceRedist -TimeoutSec 300
    $apceSignature = Get-AuthenticodeSignature -LiteralPath $apceRedist
    if ($apceSignature.Status -ne 'Valid' -or $apceSignature.SignerCertificate.Subject -notmatch 'CN=Microsoft Corporation(?:,|$)') { throw 'A assinatura Microsoft do runtime não foi validada.' }
    Write-Step 'Instalando o runtime Visual C++. Confirme a solicitação do Windows, se aparecer.'
    $apceProcess = Start-Process -FilePath $apceRedist -ArgumentList '/install','/quiet','/norestart' -Verb RunAs -WindowStyle Hidden -PassThru
    $null = $apceProcess.Handle
    $apceProcess.WaitForExit()
    if ($apceProcess.ExitCode -notin @(0,1638,3010)) { throw 'O Windows não concluiu a instalação do runtime Visual C++.' }
}
