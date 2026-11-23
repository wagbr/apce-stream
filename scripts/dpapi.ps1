$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Security
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
if ($request.operation -eq 'protect') {
    $bytes = [Text.Encoding]::UTF8.GetBytes([string]$request.value)
    $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, $scope)
    [Console]::Out.Write([Convert]::ToBase64String($result))
} elseif ($request.operation -eq 'unprotect') {
    $bytes = [Convert]::FromBase64String([string]$request.value)
    $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, $scope)
    [Console]::Out.Write([Text.Encoding]::UTF8.GetString($result))
} else { throw 'Invalid operation' }
