function Enable-APCERuntime {
    param([Parameter(Mandatory=$true)][string]$ApplicationPath)
    $apceRuntimeFolders = @(
        (Join-Path $ApplicationPath 'runtime\python-env\Scripts'),
        (Join-Path $ApplicationPath 'runtime\node'),
        (Join-Path $ApplicationPath 'runtime\ffmpeg\bin')
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }
    if ($apceRuntimeFolders.Count -gt 0) {
        $env:PATH = ($apceRuntimeFolders -join ';') + ';' + $env:PATH
    }
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
}
