param([string]$ApiBase='https://dongjiexi-api.1157364449han.workers.dev',[string]$TokenFile)
$ErrorActionPreference='Stop'
$endpoint=$null
if(-not [Uri]::TryCreate($ApiBase,[UriKind]::Absolute,[ref]$endpoint) -or $endpoint.Scheme -ne 'https' -or $endpoint.UserInfo -or $endpoint.Query -or $endpoint.Fragment -or $endpoint.AbsolutePath -ne '/'){
    throw 'Use an HTTPS API origin without a path, query or credentials.'
}
$adminToken=$null;$secureToken=$null;$tokenPointer=[IntPtr]::Zero
try{
    if($TokenFile){
        if(-not $IsWindows -or $TokenFile -notmatch '^[A-Za-z]:[\\/]'){throw 'Use an absolute Windows DPAPI token file path.'}
        $secureToken=Import-Clixml -LiteralPath ([IO.Path]::GetFullPath($TokenFile))
        if($secureToken -isnot [Security.SecureString]){throw 'Token file does not contain a Windows SecureString.'}
        $tokenPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
        $adminToken=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    }else{$adminToken=[Environment]::GetEnvironmentVariable('DONGJIEXI_ADMIN_TOKEN')}
    if(-not $adminToken -or $adminToken.Length -lt 32){throw 'Set an independent admin token or pass -TokenFile.'}
    $report=Invoke-RestMethod -Uri ([Uri]::new($endpoint,'/api/admin/usage')) -Headers @{Authorization='Bearer '+$adminToken} -TimeoutSec 15 -MaximumRedirection 0
}catch{
    # Do not print raw request/response objects: they may contain private headers.
    throw 'Usage check failed. Check the API origin, independent admin token and service status.'
}finally{
    $adminToken=$null
    if($tokenPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)}
    if($secureToken -is [Security.SecureString]){$secureToken.Dispose()}
}
if($report.inference_paused -isnot [bool] -or -not $report.usage -or $report.usage.state -notin @('normal','warning','exhausted')){
    throw 'Usage response was invalid; it cannot be treated as a normal status.'
}
[pscustomobject]@{inference_paused=$report.inference_paused;usage=$report.usage;alerts=$report.alerts;accounting=$report.accounting}|ConvertTo-Json -Depth 5
if($report.inference_paused){exit 40}
if($report.usage.state -eq 'exhausted'){exit 30}
if($report.usage.state -eq 'warning'){exit 20}
exit 0
