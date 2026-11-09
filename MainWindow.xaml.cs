using Microsoft.Web.WebView2.Core;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Media.Imaging;
using System.Windows.Interop;
using System.Windows.Shell;

namespace RevibeMediaCentre;

public partial class MainWindow : Window
{
    internal const string ProductName = "KnightWin Media Player";
    internal const string DataFolderName = "Revibe Media Centre"; // Keep the existing folder so saved settings survive the rebrand.
    internal const string AppVersion = "1.0.0";
    internal const string AppHostName = "app.revibe.local";
    internal const string MediaHostName = "media.revibe.local";
    internal const string ProxyHostName = "proxy.revibe.local";

    private string _contentRoot = string.Empty;
    private readonly string _userDataRoot;
    private readonly List<string[]> _pendingOpenMedia = [];
    private CoreWebView2Environment? _webEnvironment;
    private CancellationTokenSource? _storageWatchCancellation;
    private IntPtr _windowHandle;
    private HwndSource? _windowSource;
    private bool? _lastSquareCornerLayout;
    private bool _openMediaReady;
    private bool _discoveryReady;
    private bool _isClosing;

    public MainWindow(IEnumerable<string>? startupArguments = null)
    {
        InitializeComponent();
        _userDataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), DataFolderName);
        Directory.CreateDirectory(_userDataRoot);
        try { File.Delete(Path.Combine(_userDataRoot, "media-mappings.json")); }
        catch { /* Remove an obsolete cache from older builds when possible. */ }
        foreach (var path in FilterAssociatedMedia(startupArguments ?? [])) _pendingOpenMedia.Add([path]);
        TrySetWindowIcon(Path.Combine(AppContext.BaseDirectory, "assets", "app-icon.ico"));
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            // Keep the first window paint responsive; first-run renderer extraction can run off the UI thread.
            _contentRoot = await Task.Run(ResolveRendererRoot);
            TrySetWindowIcon(Path.Combine(_contentRoot, "assets", "app-icon.ico"));
            var profilePath = Path.Combine(_userDataRoot, "WebView2");
            Directory.CreateDirectory(profilePath);
            var options = new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required");
            _webEnvironment = await CoreWebView2Environment.CreateAsync(null, profilePath, options);
            await Browser.EnsureCoreWebView2Async(_webEnvironment);

            var core = Browser.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsSwipeNavigationEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsWebMessageEnabled = true;
            core.SetVirtualHostNameToFolderMapping(AppHostName, _contentRoot, CoreWebView2HostResourceAccessKind.Allow);
            // Serve media from a dedicated, non-folder-mapped virtual host so WebResourceRequested can provide the local file response.
            core.AddWebResourceRequestedFilter($"https://{MediaHostName}/*", CoreWebView2WebResourceContext.All);
            core.AddWebResourceRequestedFilter($"https://{ProxyHostName}/*", CoreWebView2WebResourceContext.All);
            core.WebMessageReceived += Core_WebMessageReceived;
            core.WebResourceRequested += Core_WebResourceRequested;
            core.WebResourceResponseReceived += Core_WebResourceResponseReceived;
            core.NavigationStarting += Core_NavigationStarting;
            core.NewWindowRequested += Core_NewWindowRequested;
            core.ProcessFailed += Core_ProcessFailed;
            core.ContainsFullScreenElementChanged += Core_ContainsFullScreenElementChanged;

            var bridgePath = Path.Combine(_contentRoot, "native-bridge.js");
            var bridgeScript = await File.ReadAllTextAsync(bridgePath);
            await core.AddScriptToExecuteOnDocumentCreatedAsync(bridgeScript);
            Browser.DefaultBackgroundColor = System.Drawing.Color.FromArgb(0, 0, 0, 0);
            core.Navigate($"https://{AppHostName}/index.html");

            var savedSettings = await ReadSettingsAsync();
            ApplyExternalStorageSettings(savedSettings);
            SubscribeNativeSystemEvents();
            ApplyNativeWindowAppearance();
            if (_mediaDiscoveryEnabled)
            {
                StartStorageWatcher();
                _ = RefreshExternalStoragesAsync(force: true);
            }
        }
        catch (Exception ex)
        {
            StartupOverlay.Visibility = Visibility.Collapsed;
            RuntimeErrorText.Text = "KnightWin Media Player could not start. If the Microsoft Edge WebView2 Runtime is missing, install the free Evergreen Runtime from https://developer.microsoft.com/microsoft-edge/webview2/ and try again.\n\n" +
                $"Details: {ex.Message}";
            RuntimeErrorOverlay.Visibility = Visibility.Visible;
        }
    }

    private void TrySetWindowIcon(string iconPath)
    {
        if (!File.Exists(iconPath)) return;
        try { Icon = BitmapFrame.Create(new Uri(iconPath, UriKind.Absolute)); }
        catch { /* The executable still carries its application icon. */ }
    }

    private void Window_SourceInitialized(object? sender, EventArgs e)
    {
        _windowHandle = new WindowInteropHelper(this).Handle;
        _windowSource = HwndSource.FromHwnd(_windowHandle);
        _windowSource?.AddHook(WindowMessageHook);
        RefreshWindowCornerLayout(force: true);
    }

    private void Window_StateChanged(object? sender, EventArgs e) => RefreshWindowCornerLayout(force: true);

    private void Window_SizeChanged(object sender, SizeChangedEventArgs e) => RefreshWindowCornerLayout();

    private void Window_LocationChanged(object? sender, EventArgs e) => RefreshWindowCornerLayout();

    private void RefreshWindowCornerLayout(bool force = false)
    {
        var squareCorners = IsWindowSquareCornerLayout();
        var changed = !_lastSquareCornerLayout.HasValue || _lastSquareCornerLayout.Value != squareCorners;
        if (force || changed)
        {
            _lastSquareCornerLayout = squareCorners;
            ApplyWindowChromeCornerRadius(squareCorners);
            ApplyNativeWindowAppearance();
            PublishEvent("windowState", new
            {
                maximized = WindowState == System.Windows.WindowState.Maximized,
                squareCorners
            });
        }
        UpdateSquareCornerRegion(squareCorners);
    }

    private void ApplyWindowChromeCornerRadius(bool squareCorners)
    {
        var chrome = WindowChrome.GetWindowChrome(this);
        if (chrome is null) return;

        var desired = squareCorners ? new CornerRadius(0) : new CornerRadius(8);
        if (chrome.CornerRadius.Equals(desired)) return;
        if (chrome.IsFrozen) chrome = (WindowChrome)chrome.Clone();
        chrome.CornerRadius = desired;
        WindowChrome.SetWindowChrome(this, chrome);
    }

    private void Window_Closed(object? sender, EventArgs e)
    {
        _isClosing = true;
        _windowSource?.RemoveHook(WindowMessageHook);
        _windowSource = null;
        _storageWatchCancellation?.Cancel();
        UnsubscribeNativeSystemEvents();
    }

    private void RuntimeErrorClose_Click(object sender, RoutedEventArgs e) => Close();

    private void RuntimeInstall_Click(object sender, RoutedEventArgs e)
    {
        OpenExternalUri("https://developer.microsoft.com/microsoft-edge/webview2/");
    }

    public void ReceiveSecondInstanceRequest(IEnumerable<string> arguments)
    {
        if (WindowState == System.Windows.WindowState.Minimized) WindowState = System.Windows.WindowState.Normal;
        Activate();
        BringWindowToFront();
        var paths = FilterAssociatedMedia(arguments);
        if (paths.Count > 0)
        {
            if (_openMediaReady) PublishEvent("openMedia", paths.Select(path => new { path, type = GetMediaKind(path) }).ToArray());
            else _pendingOpenMedia.Add(paths.ToArray());
        }
    }

    private async void Core_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string id = string.Empty;
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            var type = GetString(root, "type");
            if (type == "rendererReady")
            {
                StartupOverlay.Visibility = Visibility.Collapsed;
                return;
            }
            if (type == "drag")
            {
                BeginNativeWindowDrag();
                return;
            }
            if (type == "resize")
            {
                BeginNativeWindowResize(GetString(root, "edge"));
                return;
            }
            if (type != "call") return;
            id = GetString(root, "id");
            var method = GetString(root, "method");
            var args = root.TryGetProperty("args", out var value) && value.ValueKind == JsonValueKind.Array
                ? value : default;
            var result = await InvokeNativeMethodAsync(method, args);
            PostResponse(id, result, null);
        }
        catch (Exception ex)
        {
            if (!string.IsNullOrEmpty(id)) PostResponse(id, null, ex.Message);
        }
    }

    private void Core_WebResourceResponseReceived(object? sender, CoreWebView2WebResourceResponseReceivedEventArgs e)
    {
        try
        {
            if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out var uri) ||
                !uri.Host.Equals(MediaHostName, StringComparison.OrdinalIgnoreCase) ||
                !uri.AbsolutePath.StartsWith("/__media/", StringComparison.OrdinalIgnoreCase)) return;
            var contentType = string.Empty;
            var contentRange = string.Empty;
            try { contentType = e.Response.Headers.GetHeader("Content-Type"); } catch { }
            try { contentRange = e.Response.Headers.GetHeader("Content-Range"); } catch { }
            PublishEvent("mediaResponse", new { url = uri.AbsoluteUri, status = e.Response.StatusCode, contentType, contentRange });
        }
        catch { /* Playback telemetry must never interrupt media loading. */ }
    }

    private void Core_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
            uri.Scheme == Uri.UriSchemeHttps && uri.Host.Equals(AppHostName, StringComparison.OrdinalIgnoreCase)) return;
        e.Cancel = true;
        OpenExternalUri(e.Uri);
    }

    private void Core_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        OpenExternalUri(e.Uri);
    }

    private void Core_ContainsFullScreenElementChanged(object? sender, object e)
    {
        if (Dispatcher.HasShutdownStarted) return;
        _ = Dispatcher.BeginInvoke(() =>
        {
            if (!_isClosing && Browser.CoreWebView2 is { } core)
                SetNativeFullscreen(core.ContainsFullScreenElement);
        });
    }

    private void Core_ProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        if (_isClosing || e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited) return;
        Dispatcher.BeginInvoke(() =>
        {
            if (!_isClosing)
                MessageBox.Show(this, "The media view had to restart. Your library and preferences are saved on this PC.", ProductName,
                    MessageBoxButton.OK, MessageBoxImage.Warning);
        });
    }

    private void PostResponse(string id, object? result, string? error)
    {
        if (string.IsNullOrEmpty(id) || Browser.CoreWebView2 is not { } core) return;
        try
        {
            core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "response", id, result, error }, JsonOptions));
        }
        catch { /* The page may be navigating away. */ }
    }

    private void PublishEvent(string name, object? data)
    {
        if (Browser.CoreWebView2 is not { } core) return;
        void Send()
        {
            try { core.PostWebMessageAsJson(JsonSerializer.Serialize(new { type = "event", name, data }, JsonOptions)); }
            catch { /* A closed or reloading renderer will subscribe again. */ }
        }
        if (Dispatcher.CheckAccess()) Send();
        else _ = Dispatcher.BeginInvoke(Send);
    }

    private static void OpenExternalUri(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch { }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };
}
