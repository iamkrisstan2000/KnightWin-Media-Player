using System.Diagnostics;
using System.IO;
using System.Text.Json;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;

namespace RevibeMediaCentre;

public partial class MainWindow
{
    private static readonly HashSet<string> AudioExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg", ".oga", ".opus", ".wma", ".aiff", ".aif", ".ape", ".alac"
    };

    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".m4v", ".mkv", ".webm", ".mov", ".avi", ".wmv", ".mpeg", ".mpg", ".3gp", ".ts", ".m2ts"
    };

    private static readonly HashSet<string> AllowedSettings = new(StringComparer.Ordinal)
    {
        "theme", "accent", "lastCustomAccent", "visualizerIntensity", "defaultMusicFolder", "defaultVideoFolder", "volume", "lastPage",
        "mediaDiscoveryEnabled", "externalStorageEnabledIds", "automaticArtworkFetch", "visualizerStyle", "lowGraphicsMode", "equalizerEnabled", "equalizerPreset",
        "crossfadeEnabled", "crossfadeSeconds", "reverbEnabled", "reverbAmount"
    };

    private readonly SemaphoreSlim _settingsSemaphore = new(1, 1);
    private readonly string _settingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), DataFolderName, "preferences.json");
    private Dictionary<string, JsonElement> _settingsCache = new(StringComparer.Ordinal);
    private bool _settingsCacheLoaded;

    private async Task<object?> InvokeNativeMethodAsync(string method, JsonElement args)
    {
        switch (method)
        {
            case "getVersion": return AppVersion;
            case "getPlatform": return "win32";
            case "getNativeTheme": return new { shouldUseDarkColors = IsWindowsDarkMode() };
            case "getSystemAccentColor": return ReadSystemAccentColor();
            case "getWindowAppearance": return GetWindowAppearance();
            case "setWindowMaterial": return SetWindowMaterial(ArgString(args, 0));
            case "setMusicPresentationMode": return SetMusicPresentationMode(ArgBoolean(args, 0));
            case "isMaximized": return WindowState == System.Windows.WindowState.Maximized;
            case "windowAction": return HandleWindowAction(ArgString(args, 0));
            case "openSoundSettings": return OpenSoundSettings();
            case "readSettings": return await ReadSettingsAsync();
            case "saveSettings": return await SaveSettingsAsync(Arg(args, 0));
            case "chooseFolder": return await ChooseFolderAsync(ArgString(args, 0), ArgString(args, 1));
            case "scanFolder": return await ScanMediaFolderAsync(ArgString(args, 0), NormalizeKind(ArgString(args, 1)));
            case "refreshFolder": return await RefreshFolderAsync(ArgString(args, 0), NormalizeKind(ArgString(args, 1)));
            case "chooseFiles": return await ChooseFilesAsync(NormalizeKind(ArgString(args, 0)));
            case "fileUrl": return FileUrl(ArgString(args, 0));
            case "getMediaArtwork": return await GetMediaArtworkAsync(ArgString(args, 0), NormalizeKind(ArgString(args, 1)), ArgBoolean(args, 2), ArgBoolean(args, 3));
            case "searchArtwork": return await SearchArtworkAsync(Arg(args, 0));
            case "getOpenTvCatalog": return await GetOpenTvCatalogAsync(ArgBoolean(args, 0));
            case "getExternalStorages":
                StartStorageWatcher();
                return await RefreshExternalStoragesAsync(force: true);
            case "rescanExternalStorages":
                StartStorageWatcher();
                return await RescanExternalStoragesAsync();
            case "clearApplicationCaches": return await ClearApplicationCachesAsync();
            case "openMediaReady":
                _openMediaReady = true;
                FlushPendingOpenMedia();
                return true;
            case "discoveryReady":
                _discoveryReady = true;
                FlushPendingDiscoveredMedia();
                return true;
            default: throw new InvalidOperationException($"Unsupported Windows host request: {method}");
        }
    }

    private static JsonElement Arg(JsonElement args, int index)
    {
        if (args.ValueKind == JsonValueKind.Array && args.GetArrayLength() > index) return args[index];
        return default;
    }

    private static string ArgString(JsonElement args, int index)
    {
        var value = Arg(args, index);
        return value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : string.Empty;
    }

    private static bool ArgBoolean(JsonElement args, int index)
    {
        var value = Arg(args, index);
        return value.ValueKind == JsonValueKind.True || (value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out var parsed) && parsed);
    }

    private static string GetString(JsonElement element, string key)
    {
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty : string.Empty;
    }

    private static string NormalizeKind(string kind) => string.Equals(kind, "video", StringComparison.OrdinalIgnoreCase) ? "video" : "music";

    private object HandleWindowAction(string action)
    {
        if (action == "minimize") WindowState = System.Windows.WindowState.Minimized;
        else if (action == "maximize") WindowState = WindowState == System.Windows.WindowState.Maximized ? System.Windows.WindowState.Normal : System.Windows.WindowState.Maximized;
        else if (action == "close") Close();
        return new { maximized = WindowState == System.Windows.WindowState.Maximized };
    }

    private bool OpenSoundSettings()
    {
        try
        {
            Process.Start(new ProcessStartInfo("ms-settings:sound") { UseShellExecute = true });
            return true;
        }
        catch { return false; }
    }

    private async Task<Dictionary<string, JsonElement>> ReadSettingsAsync()
    {
        await _settingsSemaphore.WaitAsync();
        try
        {
            if (!_settingsCacheLoaded)
            {
                if (File.Exists(_settingsPath))
                {
                    try
                    {
                        await using var stream = File.OpenRead(_settingsPath);
                        var loaded = await JsonSerializer.DeserializeAsync<Dictionary<string, JsonElement>>(stream, JsonOptions);
                        if (loaded is not null) _settingsCache = loaded;
                    }
                    catch { _settingsCache = new(StringComparer.Ordinal); }
                }
                _settingsCacheLoaded = true;
            }
            return new Dictionary<string, JsonElement>(_settingsCache, StringComparer.Ordinal);
        }
        finally { _settingsSemaphore.Release(); }
    }

    private async Task<Dictionary<string, JsonElement>> SaveSettingsAsync(JsonElement patch)
    {
        await _settingsSemaphore.WaitAsync();
        try
        {
            if (!_settingsCacheLoaded)
            {
                if (File.Exists(_settingsPath))
                {
                    try
                    {
                        await using var stream = File.OpenRead(_settingsPath);
                        _settingsCache = await JsonSerializer.DeserializeAsync<Dictionary<string, JsonElement>>(stream, JsonOptions)
                            ?? new(StringComparer.Ordinal);
                    }
                    catch { _settingsCache = new(StringComparer.Ordinal); }
                }
                _settingsCacheLoaded = true;
            }

            if (patch.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in patch.EnumerateObject())
                    if (AllowedSettings.Contains(property.Name)) _settingsCache[property.Name] = property.Value.Clone();
            }

            Directory.CreateDirectory(Path.GetDirectoryName(_settingsPath)!);
            var temporary = _settingsPath + ".tmp";
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(_settingsCache, JsonOptions));
            File.Move(temporary, _settingsPath, overwrite: true);

            ApplyExternalStorageSettings(_settingsCache);
            if (_mediaDiscoveryEnabled)
            {
                StartStorageWatcher();
                _ = RefreshExternalStoragesAsync(force: true);
            }
            return new Dictionary<string, JsonElement>(_settingsCache, StringComparer.Ordinal);
        }
        finally { _settingsSemaphore.Release(); }
    }

    private async Task<object?> ChooseFolderAsync(string kind, string defaultPath)
    {
        var title = kind == "video" ? "Choose your videos folder" : "Choose your music folder";
        var picker = new OpenFolderDialog { Title = title, Multiselect = false, AddToRecent = false };
        if (!string.IsNullOrWhiteSpace(defaultPath) && Directory.Exists(defaultPath)) picker.InitialDirectory = defaultPath;
        var result = picker.ShowDialog(this);
        if (result != true || string.IsNullOrWhiteSpace(picker.FolderName)) return null;
        var folder = Path.GetFullPath(picker.FolderName);
        var files = await ScanMediaFolderAsync(folder, kind);
        return new { folder, files };
    }

    private async Task<object> RefreshFolderAsync(string folder, string kind)
    {
        if (string.IsNullOrWhiteSpace(folder) || !Path.IsPathRooted(folder))
            return new { ok = false, error = $"Choose a default {kind} folder first." };
        if (!Directory.Exists(folder))
            return new { ok = false, error = "The selected path is no longer a folder." };
        try
        {
            _ = Directory.EnumerateFileSystemEntries(folder).Take(1).ToArray();
            var files = await ScanMediaFolderAsync(folder, kind);
            return new { ok = true, files };
        }
        catch (Exception ex) { return new { ok = false, error = $"The selected folder is unavailable: {ex.Message}" }; }
    }

    private async Task<object[]> ChooseFilesAsync(string kind)
    {
        var extensions = kind == "video" ? VideoExtensions : AudioExtensions;
        var extensionFilter = string.Join(';', extensions.Select(ext => "*" + ext));
        var picker = new OpenFileDialog
        {
            Title = kind == "video" ? "Add video files" : "Add music files",
            Filter = $"Supported {kind} files|{extensionFilter}|All files|*.*",
            Multiselect = true,
            CheckFileExists = true,
            DereferenceLinks = true,
            AddToRecent = false
        };
        if (picker.ShowDialog(this) != true) return [];
        return await MakeMediaItemsAsync(picker.FileNames.Where(File.Exists).Where(path => extensions.Contains(Path.GetExtension(path))), kind);
    }

    private void FlushPendingOpenMedia()
    {
        if (!_openMediaReady || _pendingOpenMedia.Count == 0) return;
        var paths = _pendingOpenMedia.SelectMany(group => group).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        _pendingOpenMedia.Clear();
        PublishEvent("openMedia", paths.Select(path => new { path, type = GetMediaKind(path) }).ToArray());
    }

    private void FlushPendingDiscoveredMedia()
    {
        if (!_discoveryReady) return;
        object[] pending;
        lock (_storageLock)
        {
            if (_pendingDiscoveredMedia.Count == 0) return;
            pending = _pendingDiscoveredMedia.ToArray();
            _pendingDiscoveredMedia.Clear();
        }
        foreach (var payload in pending) PublishEvent("discoveredMedia", payload);
    }

    private static List<string> FilterAssociatedMedia(IEnumerable<string> values)
    {
        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var candidate in values)
        {
            if (string.IsNullOrWhiteSpace(candidate)) continue;
            var path = candidate.Trim().Trim('"');
            try
            {
                if (!Path.IsPathRooted(path)) continue;
                path = Path.GetFullPath(path);
                if (!File.Exists(path) || string.IsNullOrWhiteSpace(GetMediaKind(path)) || !seen.Add(path)) continue;
                result.Add(path);
            }
            catch { }
        }
        return result;
    }

    private static string GetMediaKind(string filePath)
    {
        var extension = Path.GetExtension(filePath);
        if (AudioExtensions.Contains(extension)) return "music";
        if (VideoExtensions.Contains(extension)) return "video";
        return string.Empty;
    }

    private async Task<object> ClearApplicationCachesAsync()
    {
        var foldersReset = true;
        try
        {
            var reset = new Dictionary<string, JsonElement>
            {
                ["defaultMusicFolder"] = JsonSerializer.SerializeToElement(string.Empty),
                ["defaultVideoFolder"] = JsonSerializer.SerializeToElement(string.Empty)
            };
            await SaveSettingsAsync(JsonSerializer.SerializeToElement(reset));
        }
        catch { foldersReset = false; }

        try
        {
            if (Browser.CoreWebView2 is { } core)
                await core.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache);
        }
        catch { }

        return new { ok = true, removed = 1, foldersReset, note = "Application cache cleared. Media files were not touched." };
    }
}
