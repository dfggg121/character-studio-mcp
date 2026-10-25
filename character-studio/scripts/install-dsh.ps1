param([string]$ProfilePath=(Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),[string]$DataRoot,[switch]$Uninstall,[switch]$EnableNetwork,[string]$ModelEnvFile)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$entry=Join-Path $projectRoot 'src\server.mjs'
if (-not (Test-Path -LiteralPath $entry)) { throw 'Server file missing' }
if (-not (Test-Path -LiteralPath (Join-Path $ProfilePath 'package.json'))) { throw 'Existing DSH profile required' }
$patchPath=Join-Path $ProfilePath 'cordis.patch.yml'
$begin='# BEGIN character-studio-managed'; $end='# END character-studio-managed'
$before=[IO.File]::ReadAllText($patchPath)
$pattern='(?ms)^'+[regex]::Escape($begin)+'\r?\n.*?^'+[regex]::Escape($end)+'\r?\n?'
$base=[regex]::Replace($before,$pattern,'')
if ($Uninstall) {
 if (([regex]::Replace($base,'(?m)^\s*#.*$','')).Trim().Length -eq 0) { $base=$base.TrimEnd()+[Environment]::NewLine+'[]'+[Environment]::NewLine }
 if ($base -ne $before) { [IO.File]::WriteAllText($patchPath,$base,[Text.UTF8Encoding]::new($false)) }
 Write-Output 'Character Studio MCP registration removed; other settings preserved.'
 exit 0
}
$base=[regex]::Replace($base,'(?m)^\s*\[\]\s*$','')
$nodeCommand=(Get-Command node -ErrorAction Stop).Source
$nodeVersion=& $nodeCommand --version
$nodeMajor=$nodeVersion.TrimStart('v').Split('.')[0]
if ([int]$nodeMajor -lt 22) { throw 'Node.js >=22 required' }
if (-not $DataRoot) { $DataRoot=Join-Path $projectRoot '.character-studio' }
$DataRoot=[IO.Path]::GetFullPath($DataRoot)
New-Item -ItemType Directory -Path (Join-Path $DataRoot 'install') -Force | Out-Null
$backupPath=Join-Path $DataRoot ('install\cordis-before-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')+'.yml')
[IO.File]::WriteAllText($backupPath,$before,[Text.UTF8Encoding]::new($false))
$nodeArgs=@($entry)
if ($ModelEnvFile) { if (-not (Test-Path -LiteralPath $ModelEnvFile -PathType Leaf)) { throw 'Model env file not found' }; $modelPath=(Get-Item -LiteralPath $ModelEnvFile).FullName; $nodeArgs=@(('--env-file='+$modelPath),$entry) }
$nodeArgsJson=ConvertTo-Json -InputObject $nodeArgs -Compress
& $nodeCommand (Join-Path $projectRoot 'src\check-runtime.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Run npm ci in the project before installing' }
$nodeJson=ConvertTo-Json $nodeCommand -Compress; $entryJson=ConvertTo-Json $entry -Compress; $rootJson=ConvertTo-Json $DataRoot -Compress
$buildVersion=(Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$sourceHashes=(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'src') -File | Sort-Object Name | ForEach-Object { (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }) -join ''
$hashAlgorithm=[Security.Cryptography.SHA256]::Create()
try { $buildHash=([BitConverter]::ToString($hashAlgorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($sourceHashes)))).Replace('-','').Substring(0,12).ToLowerInvariant() } finally { $hashAlgorithm.Dispose() }
$buildVersion=$buildVersion+'-'+$buildHash
$networkValue=if($EnableNetwork){'true'}else{'false'}
$block=@"
$begin
- insert:
    - id: character-studio-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        transport: stdio
        serverName: character_studio
        command: $nodeJson
        args: $nodeArgsJson
        env:
          CHARACTER_STUDIO_ROOT: $rootJson
          CHARACTER_STUDIO_NETWORK: '$networkValue'
          CHARACTER_STUDIO_BUILD: '$buildVersion'
          CHARACTER_STUDIO_REQUIRE_SESSION: 'true'
        failOnStartupError: true
$end
"@
[IO.File]::WriteAllText($patchPath,$base.TrimEnd()+[Environment]::NewLine+$block+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
Write-Output 'Character Studio MCP registered. DSH may hot-reload; otherwise restart DSH.'
Write-Output ('Backup: '+$backupPath)



