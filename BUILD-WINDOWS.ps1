$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'Revibe.MediaCentre.csproj'
$output = Join-Path $PSScriptRoot 'build\windows-x64'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'Install the .NET 8 SDK before building KnightWin Media Player.'
}

if (Test-Path $output) { Remove-Item $output -Recurse -Force }
New-Item -ItemType Directory -Path $output | Out-Null

dotnet publish $project -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:EnableWindowsTargeting=true `
    -o $output

if ($LASTEXITCODE -ne 0) { throw 'The KnightWin Media Player publish failed.' }
# API XML documentation is not needed by the self-contained runtime.
Get-ChildItem $output -Filter 'Microsoft.Web.WebView2.*.xml' -File -ErrorAction SilentlyContinue | Remove-Item -Force
$builtExe = Join-Path $output 'KnightWin-Media-Player.exe'
$versionedExe = Join-Path $output 'KnightWin-Media-Player-v1.0.0.exe'
if (-not (Test-Path $builtExe)) { throw 'The expected KnightWin Media Player executable was not produced.' }
Move-Item $builtExe $versionedExe -Force
$assetOutput = Join-Path $output 'assets'
New-Item -ItemType Directory -Path $assetOutput -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'assets\app-icon.ico') $assetOutput -Force
Copy-Item (Join-Path $PSScriptRoot 'Register-File-Associations.ps1') $output
Copy-Item (Join-Path $PSScriptRoot 'README.md') $output
Copy-Item (Join-Path $PSScriptRoot 'LICENSE') $output
Copy-Item (Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.md') $output
Copy-Item (Join-Path $PSScriptRoot 'LICENSES') $output -Recurse
Write-Host "Built $output\KnightWin-Media-Player-v1.0.0.exe"
Write-Host 'The Microsoft Edge WebView2 Evergreen Runtime must be installed on the target PC.'
