# Synthetic checks against the retained trial. Never points at an existing mailbox.
$ErrorActionPreference = 'Stop'
$legacyScript = Join-Path $PSScriptRoot '..\adapters\legacy-mail.ps1'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('mail-legacy-smoke-' + [Guid]::NewGuid().ToString('N'))
$testRepo = Join-Path $testRoot 'project'
$testMailbox = Join-Path $testRoot 'mailbox'
$passCount = 0
function Invoke-LegacyAsync([string[]]$commandArgs) {
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = (Get-Command powershell.exe).Source
    $allArgs = @('-NoProfile', '-NonInteractive', '-File', $legacyScript) + $commandArgs + @('-RepoRoot', $testRepo, '-Mailbox', $testMailbox)
    $psi.Arguments = ($allArgs | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $process = [Diagnostics.Process]::Start($psi)
    $process.StandardInput.Close()
    return @{Process=$process; Out=$process.StandardOutput.ReadToEndAsync(); Err=$process.StandardError.ReadToEndAsync()}
}
function Wait-Legacy($handle) {
    if (-not $handle.Process.WaitForExit(15000)) { $handle.Process.Kill(); throw 'Synthetic legacy command exceeded 15 seconds' }
    return @{Code=$handle.Process.ExitCode; Out=$handle.Out.Result; Err=$handle.Err.Result}
}
function Invoke-Legacy([string[]]$commandArgs) { Wait-Legacy (Invoke-LegacyAsync $commandArgs) }
function Assert-Test([string]$label, [bool]$condition) {
    if (-not $condition) { throw "FAIL $label" }
    $script:passCount++
    "PASS $label"
}
function Get-SentId($result) {
    if ($result.Code -ne 0 -or $result.Out -notmatch 'Sent (\S+) to') { throw ('Send failed: ' + $result.Err) }
    return $Matches[1]
}
try {
    New-Item -ItemType Directory -Path (Join-Path $testRepo 'src') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $testRepo 'src\sample.txt'), 'synthetic source')
    & git -C $testRepo init -q -b main
    if ($LASTEXITCODE -ne 0) { throw 'git init failed' }
    & git -C $testRepo add src
    & git -C $testRepo -c user.name=Synthetic -c user.email=synthetic@example.invalid commit -q -m seed
    if ($LASTEXITCODE -ne 0) { throw 'synthetic git seed failed' }
    $r = Invoke-Legacy @('init')
    Assert-Test 'legacy initializes synthetic mailbox' ($r.Code -eq 0)
    $id = Get-SentId (Invoke-Legacy @('send','-From','codex','-To','claude','-Kind','request','-Scope','src/','-Ref','src/sample.txt','-Body','Ask: inspect synthetic source.'))
    $r = Invoke-Legacy @('claim','-Me','claude','-Id',$id)
    Assert-Test 'legacy claim prints pinned source' ($r.Code -eq 0 -and $r.Out -match 'same as sent')
    $r = Invoke-Legacy @('done','-Me','claude','-Id',$id)
    Assert-Test 'legacy cannot close unanswered request' ($r.Code -eq 2)
    $ack = Get-SentId (Invoke-Legacy @('send','-From','claude','-Kind','ack','-ReplyTo',$id,'-Body','Receipt: synthetic packet; next inspect.'))
    $r = Invoke-Legacy @('done','-Me','claude','-Id',$id)
    Assert-Test 'legacy ACK does not complete request' ($r.Code -eq 2)
    $resultId = Get-SentId (Invoke-Legacy @('send','-From','claude','-Kind','result','-Status','ok','-ReplyTo',$id,'-Body','Verified synthetic source; no changes.'))
    $r = Invoke-Legacy @('done','-Me','claude','-Id',$id)
    Assert-Test 'legacy result allows completion' ($r.Code -eq 0)
    $r = Invoke-Legacy @('claim','-Me','codex','-Id',$resultId)
    Assert-Test 'legacy result expects no reply' ($r.Code -eq 0 -and $r.Out -match 'No reply')
    $r = Invoke-Legacy @('send','-From','codex','-Kind','ack','-ReplyTo',$resultId,'-Body','would create loop')
    Assert-Test 'legacy terminal reply is refused' ($r.Code -eq 2)
    $r = Invoke-Legacy @('validate-path','-Path','../private.txt')
    Assert-Test 'legacy traversal refused' ($r.Code -eq 2)
    $raceId = Get-SentId (Invoke-Legacy @('send','-From','codex','-To','claude','-Kind','request','-Scope','src/','-Body','Ask: competing claim.'))
    $handles = 1..4 | ForEach-Object { Invoke-LegacyAsync @('claim','-Me','claude','-Id',$raceId) }
    $results = @($handles | ForEach-Object { Wait-Legacy $_ })
    Assert-Test 'legacy competing processes have one winner' (@($results | Where-Object Code -eq 0).Count -eq 1 -and @($results | Where-Object Code -eq 4).Count -eq 3)
    [IO.File]::WriteAllText((Join-Path $testMailbox 'STOP'), 'synthetic stop')
    $r = Invoke-Legacy @('check','-Me','claude')
    Assert-Test 'legacy STOP refuses check' ($r.Code -eq 3)
    $r = Invoke-Legacy @('status')
    Assert-Test 'legacy status works during STOP' ($r.Code -eq 0 -and $r.Out -match 'STOP is SET')
    "Passed $passCount legacy checks on isolated synthetic data."
} finally {
    # Verify the absolute cleanup target remains the single created temporary tree.
    $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedTestRoot.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolvedTestRoot -Leaf) -notlike 'mail-legacy-smoke-*') { throw 'Unsafe temporary cleanup target' }
    if (Test-Path -LiteralPath $resolvedTestRoot) { Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force }
}
