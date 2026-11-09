$ErrorActionPreference = 'Stop'
$exe = Join-Path $PSScriptRoot 'KnightWin-Media-Player.exe'
if (-not (Test-Path -LiteralPath $exe)) {
    $versionedExecutable = Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'KnightWin-Media-Player-v*.exe' -File -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($versionedExecutable) { $exe = $versionedExecutable.FullName }
}
if (-not (Test-Path -LiteralPath $exe)) {
    throw "Place KnightWin-Media-Player.exe or a versioned KnightWin-Media-Player-v*.exe beside this script."
}
$exe = (Resolve-Path -LiteralPath $exe).Path
$legacyApplicationKey = 'HKCU:\Software\Classes\Applications\Revibe-Media-Centre.exe'
if (Test-Path -LiteralPath $legacyApplicationKey) {
    Remove-Item -LiteralPath $legacyApplicationKey -Recurse -Force
}
$appName = [System.IO.Path]::GetFileName($exe)
$audioProgId = 'RevibeMediaCentre.Audio'
$videoProgId = 'RevibeMediaCentre.Video'
$audioExtensions = @('.mp3','.m4a','.aac','.wav','.flac','.ogg','.oga','.opus','.wma','.aiff','.aif','.ape','.alac')
$videoExtensions = @('.mp4','.m4v','.mkv','.webm','.mov','.avi','.wmv','.mpeg','.mpg','.3gp','.ts','.m2ts')

$appKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\Applications\$appName")
$appKey.SetValue('FriendlyAppName', 'KnightWin Media Player')
$appKey.Close()
$appCommand = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\Applications\$appName\shell\open\command")
$appCommand.SetValue('', '"' + $exe + '" "%1"')
$appCommand.Close()
$appTypes = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\Applications\$appName\SupportedTypes")
foreach ($extension in ($audioExtensions + $videoExtensions)) { $appTypes.SetValue($extension, '') }
$appTypes.Close()

foreach ($entry in @(@{ ProgId = $audioProgId; Description = 'Audio files supported by KnightWin Media Player'; Extensions = $audioExtensions },
                     @{ ProgId = $videoProgId; Description = 'Video files supported by KnightWin Media Player'; Extensions = $videoExtensions })) {
    $progKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\$($entry.ProgId)")
    $progKey.SetValue('', $entry.Description)
    $progKey.Close()

    $iconKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\$($entry.ProgId)\DefaultIcon")
    $iconKey.SetValue('', '"' + $exe + '",0')
    $iconKey.Close()

    $commandKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\$($entry.ProgId)\shell\open\command")
    $commandKey.SetValue('', '"' + $exe + '" "%1"')
    $commandKey.Close()

    foreach ($extension in $entry.Extensions) {
        $registryPath = "HKCU\Software\Classes\$extension\OpenWithProgids"
        & reg.exe add $registryPath /v $entry.ProgId /t REG_NONE /f | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not register Open with for $extension." }
    }
}

Write-Host 'KnightWin Media Player is now listed under Windows Open with for supported audio and video files.'
Write-Host 'Windows still controls the default-app choice. Choose KnightWin Media Player in Open with or Default apps if desired.'
