$ErrorActionPreference='Stop'
if(-not $IsWindows){throw 'These offline DPAPI tests require Windows.'}
$repoRoot=Split-Path -Parent $PSScriptRoot
$setup=Join-Path $repoRoot 'deploy\cloudflare\setup-admin.ps1'
$checker=Join-Path $repoRoot 'deploy\cloudflare\check-usage.ps1'
$fixture=Join-Path $PSScriptRoot 'fixtures\admin-secret-cli.cjs'
$configFile=Join-Path $repoRoot 'deploy\cloudflare\wrangler.jsonc'
$temporaryRoot=Join-Path ([IO.Path]::GetTempPath()) ('dongjiexi-admin-test-'+[Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $temporaryRoot)
$tokenFile=Join-Path $temporaryRoot 'admin-token.clixml'
$secret=$null;$secure=$null;$pointer=[IntPtr]::Zero
$oldTokenFile=[Environment]::GetEnvironmentVariable('DONG_ADMIN_TEST_TOKEN_FILE')
$oldChecker=[Environment]::GetEnvironmentVariable('DONG_ADMIN_TEST_CHECKER')
try{
    $output=& $setup -TokenFile $tokenFile -WranglerScript $fixture -ConfigPath $configFile
    $secure=Import-Clixml -LiteralPath $tokenFile
    if($secure -isnot [Security.SecureString]){throw 'Provisioned file was not a SecureString.'}
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if($secret -notmatch '^[A-Za-z0-9_-]{43}$'){throw 'Token did not use 32 cryptographic random bytes.'}
    if(($output -join '\n').Contains($secret) -or [IO.File]::ReadAllText($tokenFile).Contains($secret)){throw 'Secret leaked into output or its saved file.'}
    $before=(Get-FileHash -LiteralPath $tokenFile).Hash
    $refused=$false
    try{& $setup -TokenFile $tokenFile -WranglerScript $fixture -ConfigPath $configFile}catch{$refused=$_.Exception.Message.Contains('already exists')}
    if(-not $refused -or (Get-FileHash -LiteralPath $tokenFile).Hash -ne $before){throw 'Existing token file was not preserved.'}
    [Environment]::SetEnvironmentVariable('DONG_ADMIN_TEST_TOKEN_FILE',$tokenFile)
    [Environment]::SetEnvironmentVariable('DONG_ADMIN_TEST_CHECKER',$checker)
    $childCommand=@'
function Invoke-RestMethod {
 param($Uri,$Headers,$TimeoutSec,$MaximumRedirection)
 if($Uri.AbsoluteUri -ne 'https://dongjiexi-api.1157364449han.workers.dev/api/admin/usage' -or $Headers.Authorization -notmatch '^Bearer [A-Za-z0-9_-]{43}$' -or $MaximumRedirection -ne 0){throw 'Invalid private monitoring request.'}
 return [pscustomobject]@{inference_paused=$false;usage=[pscustomobject]@{state='warning';used=160;maximum=200};alerts=@();accounting='offline fixture'}
}
& $env:DONG_ADMIN_TEST_CHECKER -TokenFile $env:DONG_ADMIN_TEST_TOKEN_FILE
exit $LASTEXITCODE
'@
    $childOutput=& (Get-Process -Id $PID).Path -NoProfile -NonInteractive -Command $childCommand
    if($LASTEXITCODE -ne 20 -or ($childOutput -join '\n').Contains($secret)){throw 'DPAPI monitoring failed or exposed the token.'}
    Write-Output 'PASS offline admin scripts: DPAPI file, no token in args/output, no-clobber, token-file usage query and warning exit code.'
}finally{
    $secret=$null
    if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
    if($secure){$secure.Dispose()}
    [Environment]::SetEnvironmentVariable('DONG_ADMIN_TEST_TOKEN_FILE',$oldTokenFile)
    [Environment]::SetEnvironmentVariable('DONG_ADMIN_TEST_CHECKER',$oldChecker)
    if(Test-Path -LiteralPath $tokenFile){Remove-Item -LiteralPath $tokenFile}
    if(Test-Path -LiteralPath $temporaryRoot){Remove-Item -LiteralPath $temporaryRoot}
}
