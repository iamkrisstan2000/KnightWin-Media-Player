using Microsoft.Win32;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace RevibeMediaCentre;

public partial class MainWindow
{
    private const int DwmwaUseImmersiveDarkMode = 20;
    private const int DwmwaWindowCornerPreference = 33;
    private const int DwmwaBorderColor = 34;
    private const int DwmwaSystemBackdropType = 38;
    private const int DwmSystemBackdropTransientWindow = 3;
    private const int DwmWindowCornerRound = 2;
    private const int DwmWindowCornerDoNotRound = 1;
    private const int DwmColorNone = unchecked((int)0xFFFFFFFE);
    private const int WmGetMinMaxInfo = 0x0024;
    private const uint MonitorDefaultToNearest = 0x00000002;
    private const uint WmNcLButtonDown = 0x00A1;
    private const int HtCaption = 2;
    private const int HtLeft = 10;
    private const int HtRight = 11;
    private const int HtTop = 12;
    private const int HtTopLeft = 13;
    private const int HtTopRight = 14;
    private const int HtBottom = 15;
    private const int HtBottomLeft = 16;
    private const int HtBottomRight = 17;
    private const int WcaAccentPolicy = 19;
    private const int AccentEnableAcrylicBlurBehind = 4;
    private const double StandardMinimumWidth = 1024;
    private const double MusicPresentationMinimumWidth = 800;
    private const double MinimumWindowHeight = 600;

    private bool _systemEventsSubscribed;
    private bool _nativeFullscreenActive;
    private System.Windows.WindowState _fullscreenPreviousWindowState;
    private Rect _fullscreenPreviousBounds = Rect.Empty;
    private bool _squareCornerRegionApplied;
    private int _squareCornerRegionWidth;
    private int _squareCornerRegionHeight;

    private void SubscribeNativeSystemEvents()
    {
        if (_systemEventsSubscribed) return;
        SystemEvents.UserPreferenceChanged += SystemEvents_UserPreferenceChanged;
        _systemEventsSubscribed = true;
    }

    private void UnsubscribeNativeSystemEvents()
    {
        if (!_systemEventsSubscribed) return;
        SystemEvents.UserPreferenceChanged -= SystemEvents_UserPreferenceChanged;
        _systemEventsSubscribed = false;
    }

    private void SystemEvents_UserPreferenceChanged(object sender, UserPreferenceChangedEventArgs e)
    {
        if (e.Category is UserPreferenceCategory.Color or UserPreferenceCategory.General)
        {
            var color = ReadSystemAccentColor();
            if (!string.IsNullOrWhiteSpace(color)) PublishEvent("systemAccentChanged", color);
        }
    }

    private string? ReadSystemAccentColor()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\DWM");
            var value = key?.GetValue("AccentColor");
            if (value is null) return null;
            var raw = value switch
            {
                int signed => unchecked((uint)signed),
                uint unsigned => unsigned,
                long signedLong => unchecked((uint)signedLong),
                ulong unsignedLong => unchecked((uint)unsignedLong),
                _ => Convert.ToUInt32(value)
            };
            var red = raw & 0xFF;
            var green = (raw >> 8) & 0xFF;
            var blue = (raw >> 16) & 0xFF;
            return $"#{red:X2}{green:X2}{blue:X2}";
        }
        catch { return null; }
    }

    private static bool IsWindowsDarkMode()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return Convert.ToInt32(key?.GetValue("AppsUseLightTheme", 1)) == 0;
        }
        catch { return false; }
    }

    private static int? _cachedWindowsBuild;

    private static int GetWindowsBuild()
    {
        if (_cachedWindowsBuild is int cached) return cached;
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            var build = key?.GetValue("CurrentBuildNumber")?.ToString();
            if (int.TryParse(build, out var value))
            {
                _cachedWindowsBuild = value;
                return value;
            }
        }
        catch { }
        var fallback = Environment.OSVersion.Version.Build;
        _cachedWindowsBuild = fallback;
        return fallback;
    }

    private object GetWindowAppearance()
    {
        var build = GetWindowsBuild();
        var dwmEnabled = build >= 10240;
        var supportsCorners = build >= 22000;
        var supportsBackdrop = build >= 22621;
        var nativeSurface = supportsCorners && supportsBackdrop;
        return new
        {
            platform = "win32",
            windowsBuild = build,
            dwmEnabled,
            supportsRoundedCorners = supportsCorners,
            supportsBackdropMaterial = supportsBackdrop,
            usesNativeRoundedSurface = nativeSurface,
            windowCornerStyle = nativeSurface ? "native-rounded" : build >= 10240 ? "rounded" : "square",
            squareCorners = IsWindowSquareCornerLayout()
        };
    }

    private void ApplyNativeWindowAppearance(string? requestedMode = null)
    {
        if (_windowHandle == IntPtr.Zero) return;
        var build = GetWindowsBuild();
        var dark = string.Equals(requestedMode, "dark", StringComparison.OrdinalIgnoreCase) ||
                   (string.IsNullOrWhiteSpace(requestedMode) && IsWindowsDarkMode());

        try
        {
            var darkValue = dark ? 1 : 0;
            _ = DwmSetWindowAttribute(_windowHandle, DwmwaUseImmersiveDarkMode, ref darkValue, sizeof(int));
            var border = DwmColorNone;
            _ = DwmSetWindowAttribute(_windowHandle, DwmwaBorderColor, ref border, sizeof(int));

            if (build >= 22621)
            {
                // Prefer Windows 11's native Acrylic backdrop; it avoids the legacy
                // AccentPolicy tint rendering as an overly dark solid layer in WebView2.
                var backdrop = DwmSystemBackdropTransientWindow;
                var backdropResult = DwmSetWindowAttribute(_windowHandle, DwmwaSystemBackdropType, ref backdrop, sizeof(int));
                if (backdropResult != 0) _ = SetAcrylicBackdrop(_windowHandle, dark);
            }
            else if (build >= 17763)
            {
                _ = SetAcrylicBackdrop(_windowHandle, dark);
            }
        }
        catch { /* Windows keeps its regular window surface if DWM material is unavailable. */ }

        var corner = IsWindowSquareCornerLayout() ? DwmWindowCornerDoNotRound : DwmWindowCornerRound;
        if (build >= 22000)
        {
            try { _ = DwmSetWindowAttribute(_windowHandle, DwmwaWindowCornerPreference, ref corner, sizeof(int)); }
            catch { }
        }
    }

    private bool IsWindowSquareCornerLayout()
    {
        if (WindowState == System.Windows.WindowState.Maximized) return true;
        if (_windowHandle == IntPtr.Zero || GetWindowsBuild() < 22000) return false;
        if (!GetWindowRect(_windowHandle, out var bounds)) return false;

        var monitor = MonitorFromWindow(_windowHandle, MonitorDefaultToNearest);
        if (monitor == IntPtr.Zero) return false;
        var monitorInfo = new NativeMonitorInfo { Size = Marshal.SizeOf<NativeMonitorInfo>() };
        if (!GetMonitorInfo(monitor, ref monitorInfo)) return false;

        var work = monitorInfo.Work;
        var workWidth = work.Right - work.Left;
        var workHeight = work.Bottom - work.Top;
        var width = bounds.Right - bounds.Left;
        var height = bounds.Bottom - bounds.Top;
        if (workWidth <= 0 || workHeight <= 0 || width <= 0 || height <= 0) return false;

        // Win11 Snap left/right fills the work-area height and aligns one side of a
        // roughly half-width window to the monitor edge. Allow for invisible frame/DPI pixels.
        var transform = _windowSource?.CompositionTarget?.TransformToDevice;
        var toleranceX = Math.Max(12, (int)Math.Ceiling(16 * (transform?.M11 ?? 1.0)));
        var toleranceY = Math.Max(12, (int)Math.Ceiling(16 * (transform?.M22 ?? 1.0)));
        var fillsHeight = Math.Abs(bounds.Top - work.Top) <= toleranceY &&
                          Math.Abs(bounds.Bottom - work.Bottom) <= toleranceY;
        var touchesSide = Math.Abs(bounds.Left - work.Left) <= toleranceX ||
                          Math.Abs(bounds.Right - work.Right) <= toleranceX;
        var snapWidth = width >= workWidth * .25 && width <= workWidth * .85;
        return fillsHeight && touchesSide && snapWidth;
    }

    private void UpdateSquareCornerRegion(bool squareCorners)
    {
        if (_windowHandle == IntPtr.Zero) return;

        if (!squareCorners)
        {
            if (_squareCornerRegionApplied && SetWindowRgn(_windowHandle, IntPtr.Zero, true))
            {
                _squareCornerRegionApplied = false;
                _squareCornerRegionWidth = 0;
                _squareCornerRegionHeight = 0;
            }
            return;
        }

        if (GetWindowsBuild() < 22000 || !GetWindowRect(_windowHandle, out var bounds)) return;
        var width = bounds.Right - bounds.Left;
        var height = bounds.Bottom - bounds.Top;
        if (width <= 0 || height <= 0) return;
        if (_squareCornerRegionApplied && width == _squareCornerRegionWidth && height == _squareCornerRegionHeight) return;

        // A rectangular native region suppresses WPF/DWM corner rounding for both
        // maximized and Windows-snapped edge layouts, without changing work-area bounds.
        var region = CreateRectRgn(0, 0, width, height);
        if (region == IntPtr.Zero) return;
        if (SetWindowRgn(_windowHandle, region, true))
        {
            _squareCornerRegionApplied = true; // Windows owns the region after success.
            _squareCornerRegionWidth = width;
            _squareCornerRegionHeight = height;
        }
        else
            _ = DeleteObject(region);
    }

    private void SetNativeFullscreen(bool enabled)
    {
        if (_windowHandle == IntPtr.Zero || enabled == _nativeFullscreenActive) return;
        if (enabled)
        {
            _fullscreenPreviousWindowState = WindowState;
            _fullscreenPreviousBounds = RestoreBounds;
            if (_fullscreenPreviousBounds.IsEmpty ||
                !double.IsFinite(_fullscreenPreviousBounds.Left) ||
                !double.IsFinite(_fullscreenPreviousBounds.Top) ||
                _fullscreenPreviousBounds.Width <= 0 || _fullscreenPreviousBounds.Height <= 0)
            {
                var left = double.IsFinite(Left) ? Left : 0;
                var top = double.IsFinite(Top) ? Top : 0;
                var width = double.IsFinite(Width) ? Width : MinWidth;
                var height = double.IsFinite(Height) ? Height : MinHeight;
                _fullscreenPreviousBounds = new Rect(left, top, width, height);
            }
            _nativeFullscreenActive = true;

            // The WebView's fullscreen element otherwise only fills the restored
            // window. Re-run native maximize after switching the hook to monitor bounds.
            WindowState = System.Windows.WindowState.Normal;
            WindowState = System.Windows.WindowState.Maximized;
            return;
        }

        _nativeFullscreenActive = false;
        WindowState = System.Windows.WindowState.Normal;
        if (!_fullscreenPreviousBounds.IsEmpty && _fullscreenPreviousBounds.Width > 0 && _fullscreenPreviousBounds.Height > 0)
        {
            Left = _fullscreenPreviousBounds.Left;
            Top = _fullscreenPreviousBounds.Top;
            Width = _fullscreenPreviousBounds.Width;
            Height = _fullscreenPreviousBounds.Height;
        }
        if (_fullscreenPreviousWindowState == System.Windows.WindowState.Maximized)
            WindowState = System.Windows.WindowState.Maximized;
        _fullscreenPreviousBounds = Rect.Empty;
    }

    private IntPtr WindowMessageHook(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (message != WmGetMinMaxInfo || lParam == IntPtr.Zero) return IntPtr.Zero;

        var monitor = MonitorFromWindow(hwnd, MonitorDefaultToNearest);
        if (monitor == IntPtr.Zero) return IntPtr.Zero;

        var monitorInfo = new NativeMonitorInfo { Size = Marshal.SizeOf<NativeMonitorInfo>() };
        if (!GetMonitorInfo(monitor, ref monitorInfo)) return IntPtr.Zero;

        // Normal maximize stays in the taskbar-safe work area. An HTML fullscreen
        // request temporarily switches the same hook to the whole monitor rectangle.
        var info = Marshal.PtrToStructure<NativeMinMaxInfo>(lParam);
        var bounds = _nativeFullscreenActive ? monitorInfo.Monitor : monitorInfo.Work;
        info.MaxPosition.X = bounds.Left - monitorInfo.Monitor.Left;
        info.MaxPosition.Y = bounds.Top - monitorInfo.Monitor.Top;
        info.MaxSize.X = bounds.Right - bounds.Left;
        info.MaxSize.Y = bounds.Bottom - bounds.Top;

        // Keep the WPF minimum window size in normal/maximized app mode. Fullscreen
        // must be allowed to cover the monitor even if its resolution is smaller.
        if (!_nativeFullscreenActive)
        {
            var transform = _windowSource?.CompositionTarget?.TransformToDevice;
            var scaleX = transform?.M11 ?? 1.0;
            var scaleY = transform?.M22 ?? 1.0;
            if (double.IsFinite(MinWidth))
                info.MinTrackSize.X = Math.Max(info.MinTrackSize.X, (int)Math.Ceiling(MinWidth * scaleX));
            if (double.IsFinite(MinHeight))
                info.MinTrackSize.Y = Math.Max(info.MinTrackSize.Y, (int)Math.Ceiling(MinHeight * scaleY));
        }

        Marshal.StructureToPtr(info, lParam, false);
        handled = true;
        return IntPtr.Zero;
    }

    private bool SetWindowMaterial(string mode)
    {
        var safeMode = string.Equals(mode, "dark", StringComparison.OrdinalIgnoreCase) ? "dark" : "light";
        ApplyNativeWindowAppearance(safeMode);
        return GetWindowsBuild() >= 22621;
    }

    private bool SetMusicPresentationMode(bool enabled)
    {
        MinWidth = enabled ? MusicPresentationMinimumWidth : StandardMinimumWidth;
        MinHeight = MinimumWindowHeight;
        return true;
    }

    private void BeginNativeWindowDrag()
    {
        // Let Windows perform the standard restore-and-drag behavior when the user
        // starts moving a maximized window by its titlebar.
        if (_windowHandle == IntPtr.Zero || _nativeFullscreenActive) return;
        BeginNativeNonClientDrag(HtCaption);
    }

    private void BeginNativeWindowResize(string? edge)
    {
        if (_windowHandle == IntPtr.Zero || ResizeMode == System.Windows.ResizeMode.NoResize ||
            WindowState != System.Windows.WindowState.Normal || _nativeFullscreenActive) return;

        var hitTest = edge?.ToLowerInvariant() switch
        {
            "left" => HtLeft,
            "right" => HtRight,
            "top" => HtTop,
            "bottom" => HtBottom,
            "top-left" => HtTopLeft,
            "top-right" => HtTopRight,
            "bottom-left" => HtBottomLeft,
            "bottom-right" => HtBottomRight,
            _ => 0
        };
        if (hitTest != 0) BeginNativeNonClientDrag(hitTest);
    }

    private void BeginNativeNonClientDrag(int hitTest)
    {
        try
        {
            var point = GetCursorPos(out var cursorPosition) ? MakeScreenPointLParam(cursorPosition) : IntPtr.Zero;
            _ = ReleaseCapture();
            _ = SendMessage(_windowHandle, WmNcLButtonDown, new IntPtr(hitTest), point);
        }
        catch { }
    }

    private static IntPtr MakeScreenPointLParam(NativePoint point)
    {
        var packed = unchecked((uint)(ushort)point.X | ((uint)(ushort)point.Y << 16));
        return new IntPtr(unchecked((int)packed));
    }

    private void BringWindowToFront()
    {
        if (_windowHandle == IntPtr.Zero) _windowHandle = new WindowInteropHelper(this).Handle;
        if (_windowHandle != IntPtr.Zero)
        {
            _ = ShowWindow(_windowHandle, 9);
            _ = SetForegroundWindow(_windowHandle);
        }
    }

    private static bool SetAcrylicBackdrop(IntPtr hwnd, bool dark)
    {
        var policy = new AccentPolicy
        {
            AccentState = AccentEnableAcrylicBlurBehind,
            AccentFlags = 2,
            // Windows stores this tint in AABBGGRR order.
            // 13% show-through in dark mode (87% tint opacity); 5% in light mode (95% opacity).
            GradientColor = dark ? unchecked((int)0xDE1D1816) : unchecked((int)0xF2F1F4F7)
        };
        var size = Marshal.SizeOf<AccentPolicy>();
        var memory = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(policy, memory, false);
            var data = new WindowCompositionAttributeData
            {
                Attribute = WcaAccentPolicy,
                Data = memory,
                SizeOfData = size
            };
            return SetWindowCompositionAttribute(hwnd, ref data) != 0;
        }
        finally { Marshal.FreeHGlobal(memory); }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeMinMaxInfo
    {
        public NativePoint Reserved;
        public NativePoint MaxSize;
        public NativePoint MaxPosition;
        public NativePoint MinTrackSize;
        public NativePoint MaxTrackSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeRect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeMonitorInfo
    {
        public int Size;
        public NativeRect Monitor;
        public NativeRect Work;
        public uint Flags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct AccentPolicy
    {
        public int AccentState;
        public int AccentFlags;
        public int GradientColor;
        public int AnimationId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WindowCompositionAttributeData
    {
        public int Attribute;
        public IntPtr Data;
        public int SizeOfData;
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr hwnd, out NativeRect rect);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowRgn(IntPtr hwnd, IntPtr region, [MarshalAs(UnmanagedType.Bool)] bool redraw);

    [DllImport("gdi32.dll", SetLastError = true)]
    private static extern IntPtr CreateRectRgn(int left, int top, int right, int bottom);

    [DllImport("gdi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DeleteObject(IntPtr handle);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);

    [DllImport("user32.dll", EntryPoint = "GetMonitorInfoW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref NativeMonitorInfo info);

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetCursorPos(out NativePoint point);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hwnd, int command);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int SetWindowCompositionAttribute(IntPtr hwnd, ref WindowCompositionAttributeData data);
}
