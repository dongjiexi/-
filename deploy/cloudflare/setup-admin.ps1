param(
    [Parameter(Mandatory=$true)][string]$TokenFile,
    [Parameter(Mandatory=$true)][string]$WranglerScript,
    [Parameter(Mandatory=$true)][string]$ConfigPath,
    [string]$NodeExecutable=(Get-Command node -ErrorAction Stop).Source
)
$ErrorActionPreference='Stop'
if(-not $IsWindows -or $PSVersionTable.PSVersion.Major -lt 7){throw 'Use PowerShell 7 on Windows so Export-Clixml protects the token with Windows DPAPI.'}
function AbsoluteLocalFile([string]$Path){
    if($Path -notmatch '^[A-Za-z]:[\\/]'){throw 'Provide an explicit absolute local file path.'}
    return [IO.Path]::GetFullPath($Path)
}
$tokenPath=AbsoluteLocalFile $TokenFile
$wranglerPath=AbsoluteLocalFile $WranglerScript
$configFile=AbsoluteLocalFile $ConfigPath
$nodePath=AbsoluteLocalFile $NodeExecutable
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if($tokenPath.StartsWith($repoRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Keep the encrypted token outside the project and its release packages.'}
if(Test-Path -LiteralPath $tokenPath){throw 'Token file already exists; it was preserved. Use a new private filename for rotation.'}
foreach($inputPath in @($wranglerPath,$configFile,$nodePath)){if(-not(Test-Path -LiteralPath $inputPath -PathType Leaf)){throw 'Required Node, Wrangler or private configuration file is missing.'}}
$directory=Split-Path -Parent $tokenPath
if(-not(Test-Path -LiteralPath $directory -PathType Container)){throw 'Create the explicitly chosen private token directory before provisioning.'}
$tempPath=Join-Path $directory ('.admin-token-'+[Guid]::NewGuid().ToString('N')+'.clixml')
$tokenBytes=[byte[]]::new(32)
$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
$adminToken=$null;$secureToken=$null;$process=$null
try{
    $rng.GetBytes($tokenBytes)
    $adminToken=[Convert]::ToBase64String($tokenBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    $secureToken=ConvertTo-SecureString -String $adminToken -AsPlainText -Force
    $secureToken|Export-Clixml -LiteralPath $tempPath -NoClobber
    # File.Move without overwrite is the final race-safe no-clobber check. Save
    # recovery material before modifying the remote secret; retain it on failure.
    [IO.File]::Move($tempPath,$tokenPath)
    $start=[Diagnostics.ProcessStartInfo]::new()
    $start.FileName=$nodePath
    foreach($argument in @($wranglerPath,'secret','put','DONGJIEXI_ADMIN_TOKEN','--config',$configFile)){[void]$start.ArgumentList.Add($argument)}
    $start.WorkingDirectory=Split-Path -Parent $configFile
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $process=[Diagnostics.Process]::new();$process.StartInfo=$start
    [void]$process.Start()
    # Drain output to avoid pipe deadlock, but never echo CLI output: external
    # tools are not trusted to keep secret input out of their error messages.
    $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
    $process.StandardInput.WriteLine($adminToken);$process.StandardInput.Close();$adminToken=$null
    $process.WaitForExit()
    [void]$stdout.GetAwaiter().GetResult();[void]$stderr.GetAwaiter().GetResult()
    if($process.ExitCode -ne 0){throw 'Wrangler secret provisioning failed. The encrypted token file was preserved; inspect cloud status before retrying with a new filename.'}
    Write-Output 'Administrator secret provisioned. The token is saved encrypted for this Windows user. No model request or scheduled monitor was created.'
}finally{
    $adminToken=$null
    if($secureToken){$secureToken.Dispose()}
    [Array]::Clear($tokenBytes,0,$tokenBytes.Length);$rng.Dispose()
    if($process){$process.Dispose()}
    # Only this explicitly generated scratch file may be removed; never touch an
    # existing token file, including after an uncertain remote provisioning error.
    if(Test-Path -LiteralPath $tempPath){Remove-Item -LiteralPath $tempPath}
}
