using System.Diagnostics;
using System.IO;
using System.Text.Json;

namespace RevibeMediaCentre;

public partial class MainWindow
{
    private sealed record ExternalStorage(string Id, string Root, string Name, string Kind, long Size, long Free);
    private readonly object _storageLock = new();
    private readonly HashSet<string> _scannedExternalStorageIds = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _enabledExternalStorageIds = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<object> _pendingDiscoveredMedia = [];
    private ExternalStorage[] _currentExternalStorages = [];
    private string _externalStorageFingerprint = string.Empty;
    private int _storageRefreshRunning;
    private volatile bool _mediaDiscoveryEnabled;

    private void StartStorageWatcher()
    {
        if (_storageWatchCancellation is not null) return;
        _storageWatchCancellation = new CancellationTokenSource();
        var token = _storageWatchCancellation.Token;
        _ = Task.Run(async () =>
        {
            try
            {
                using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
                while (await timer.WaitForNextTickAsync(token))
                    await RefreshExternalStoragesAsync(force: false);
            }
            catch (OperationCanceledException) { }
            catch { }
        }, token);
    }

    private async Task<ExternalStorage[]> RefreshExternalStoragesAsync(bool force)
    {
        if (Interlocked.Exchange(ref _storageRefreshRunning, 1) != 0) return _currentExternalStorages;
        try
        {
            var volumes = await EnumerateExternalStoragesAsync();
            var fingerprint = JsonSerializer.Serialize(volumes, JsonOptions);
            var changed = !string.Equals(fingerprint, _externalStorageFingerprint, StringComparison.Ordinal);
            _currentExternalStorages = volumes;
            _externalStorageFingerprint = fingerprint;

            var connected = new HashSet<string>(volumes.Select(volume => volume.Id), StringComparer.OrdinalIgnoreCase);
            lock (_storageLock)
                _scannedExternalStorageIds.RemoveWhere(id => !connected.Contains(id));

            if (changed || force) PublishEvent("externalStorages", volumes);
            if (_mediaDiscoveryEnabled)
            {
                foreach (var volume in volumes)
                {
                    var shouldScan = false;
                    lock (_storageLock)
                    {
                        if (_enabledExternalStorageIds.Contains(volume.Id))
                            shouldScan = _scannedExternalStorageIds.Add(volume.Id);
                        else
                            _scannedExternalStorageIds.Remove(volume.Id);
                    }
                    if (shouldScan) _ = ScanDiscoveredVolumeAsync(volume);
                }
            }
            return volumes;
        }
        catch { return _currentExternalStorages; }
        finally { Interlocked.Exchange(ref _storageRefreshRunning, 0); }
    }

    private async Task<ExternalStorage[]> RescanExternalStoragesAsync()
    {
        lock (_storageLock) _scannedExternalStorageIds.Clear();
        return await RefreshExternalStoragesAsync(force: true);
    }

    private void ApplyExternalStorageSettings(IReadOnlyDictionary<string, JsonElement> values)
    {
        var enabled = values.TryGetValue("mediaDiscoveryEnabled", out var discovery) && discovery.ValueKind == JsonValueKind.True;
        var nextEnabledIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (values.TryGetValue("externalStorageEnabledIds", out var savedDrives))
        {
            if (savedDrives.ValueKind == JsonValueKind.Object)
            {
                foreach (var drive in savedDrives.EnumerateObject())
                    if (drive.Value.ValueKind == JsonValueKind.True && !string.IsNullOrWhiteSpace(drive.Name)) nextEnabledIds.Add(drive.Name);
            }
            else if (savedDrives.ValueKind == JsonValueKind.Array)
            {
                foreach (var drive in savedDrives.EnumerateArray())
                    if (drive.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(drive.GetString())) nextEnabledIds.Add(drive.GetString()!);
            }
        }

        lock (_storageLock)
        {
            var wasDiscoveryEnabled = _mediaDiscoveryEnabled;
            var changedIds = new HashSet<string>(_enabledExternalStorageIds, StringComparer.OrdinalIgnoreCase);
            changedIds.SymmetricExceptWith(nextEnabledIds);
            foreach (var id in changedIds) _scannedExternalStorageIds.Remove(id);

            _enabledExternalStorageIds.Clear();
            _enabledExternalStorageIds.UnionWith(nextEnabledIds);
            _mediaDiscoveryEnabled = enabled;

            if (!enabled)
                _pendingDiscoveredMedia.Clear();
            else if (!wasDiscoveryEnabled)
                _scannedExternalStorageIds.Clear();
        }
    }

    private async Task<ExternalStorage[]> EnumerateExternalStoragesAsync()
    {
        try
        {
            const string script = @"
$ErrorActionPreference = 'SilentlyContinue'
$found = @{}
foreach ($d in @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2')) {
  $root = ([string]$d.DeviceID + [char]92)
  $label = [string]$d.VolumeName
  if (!$label) { $label = 'Removable storage' }
  $found[$root] = [PSCustomObject]@{ id = ([string]$d.DeviceID + ':' + [string]$d.VolumeSerialNumber); root = $root; name = $label; kind = 'Removable drive'; size = [int64]$d.Size; free = [int64]$d.FreeSpace }
}
try {
  foreach ($disk in @(Get-Disk | Where-Object { $_.BusType.ToString() -eq 'USB' })) {
    foreach ($partition in @(Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue)) {
      $volume = Get-Volume -Partition $partition -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($volume -and $volume.DriveLetter) {
        $letter = [string]$volume.DriveLetter + ':'
        $root = $letter + [char]92
        $label = [string]$volume.FileSystemLabel
        if (!$label) { $label = 'USB storage' }
        $found[$root] = [PSCustomObject]@{ id = ($root + '|' + [string]$volume.UniqueId); root = $root; name = $label; kind = 'USB drive'; size = [int64]$volume.Size; free = [int64]$volume.SizeRemaining }
      }
    }
  }
} catch {}
$found.Values | Sort-Object Root | ConvertTo-Json -Depth 3 -Compress
";
            var encoded = Convert.ToBase64String(System.Text.Encoding.Unicode.GetBytes(script));
            var start = new ProcessStartInfo("powershell.exe")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8
            };
            start.ArgumentList.Add("-NoLogo");
            start.ArgumentList.Add("-NoProfile");
            start.ArgumentList.Add("-NonInteractive");
            start.ArgumentList.Add("-ExecutionPolicy");
            start.ArgumentList.Add("Bypass");
            start.ArgumentList.Add("-EncodedCommand");
            start.ArgumentList.Add(encoded);

            using var process = Process.Start(start);
            if (process is null) return EnumerateRemovableDriveFallback();
            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
            try { await process.WaitForExitAsync(timeout.Token); }
            catch (OperationCanceledException)
            {
                try { process.Kill(entireProcessTree: true); } catch { }
                return EnumerateRemovableDriveFallback();
            }
            await Task.WhenAll(outputTask, errorTask);
            var output = outputTask.Result.Trim();
            if (string.IsNullOrWhiteSpace(output) || output == "null") return EnumerateRemovableDriveFallback();
            using var document = JsonDocument.Parse(output);
            var rows = document.RootElement.ValueKind == JsonValueKind.Array
                ? document.RootElement.EnumerateArray().ToArray()
                : [document.RootElement];
            return rows.Where(row => row.ValueKind == JsonValueKind.Object)
                .Select(row => new ExternalStorage(
                    GetString(row, "id"), GetString(row, "root"), GetString(row, "name"), GetString(row, "kind"),
                    GetInt64(row, "size"), GetInt64(row, "free")))
                .Where(volume => IsDriveRoot(volume.Root))
                .OrderBy(volume => volume.Root, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
        catch { return EnumerateRemovableDriveFallback(); }
    }

    private static ExternalStorage[] EnumerateRemovableDriveFallback()
    {
        var result = new List<ExternalStorage>();
        try
        {
            foreach (var drive in DriveInfo.GetDrives())
            {
                try
                {
                    if (drive.DriveType != DriveType.Removable || !drive.IsReady) continue;
                    var root = drive.RootDirectory.FullName;
                    result.Add(new ExternalStorage(
                        root + drive.VolumeLabel, root, string.IsNullOrWhiteSpace(drive.VolumeLabel) ? "Removable storage" : drive.VolumeLabel,
                        "Removable drive", drive.TotalSize, drive.AvailableFreeSpace));
                }
                catch { }
            }
        }
        catch { }
        return result.ToArray();
    }

    private async Task ScanDiscoveredVolumeAsync(ExternalStorage volume)
    {
        try
        {
            var musicTask = ScanMediaFolderAsync(volume.Root, "music");
            var videoTask = ScanMediaFolderAsync(volume.Root, "video");
            await Task.WhenAll(musicTask, videoTask);
            var payload = new { volume, music = musicTask.Result, videos = videoTask.Result };
            lock (_storageLock)
            {
                if (!_mediaDiscoveryEnabled || !_enabledExternalStorageIds.Contains(volume.Id) ||
                    !_currentExternalStorages.Any(current => current.Id.Equals(volume.Id, StringComparison.OrdinalIgnoreCase))) return;
                if (!_discoveryReady) _pendingDiscoveredMedia.Add(payload);
                else PublishEvent("discoveredMedia", payload);
            }
        }
        catch { /* A locked, removed or unplugged volume is safely ignored. */ }
    }

    private static long GetInt64(JsonElement row, string property)
    {
        if (!row.TryGetProperty(property, out var value)) return 0;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var number)) return number;
        if (value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), out number)) return number;
        return 0;
    }

    private static bool IsDriveRoot(string root)
    {
        return root.Length == 3 && char.IsAsciiLetter(root[0]) && root[1] == ':' && (root[2] == '\\' || root[2] == '/');
    }
}
