function Open-APCEBrowser {
    param([Parameter(Mandatory=$true)][string]$Url)
    $apceDataRoot=$env:APCE_STREAM_DATA_DIR
    if(!$apceDataRoot -and $env:LOCALAPPDATA){$apceDataRoot=Join-Path $env:LOCALAPPDATA 'APCE Stream'}
    if($apceDataRoot){
        $apceBrowserConfig=Join-Path $apceDataRoot 'browser.json'
        try{
            if(Test-Path -LiteralPath $apceBrowserConfig){
                $apceBrowser=Get-Content -LiteralPath $apceBrowserConfig -Raw -Encoding UTF8 | ConvertFrom-Json
                if($apceBrowser.browser -eq 'chrome' -and $apceBrowser.profileDirectory -match '^(Default|Profile \d+)$'){
                    $apceProfilePath=Join-Path $env:LOCALAPPDATA ('Google\Chrome\User Data\'+$apceBrowser.profileDirectory)
                    $apceCandidates=@((Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),(Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),(Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'))
                    $apceChrome=$apceCandidates | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
                    if($apceChrome -and (Test-Path -LiteralPath $apceProfilePath)){
                        Start-Process -FilePath $apceChrome -ArgumentList ('--profile-directory="'+$apceBrowser.profileDirectory+'" "'+$Url+'"')
                        return
                    }
                }
            }
        }catch{Write-Verbose 'Preferência de navegador indisponível; usando o navegador padrão.'}
    }
    Start-Process $Url
}
