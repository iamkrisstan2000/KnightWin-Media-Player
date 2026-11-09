# Third-party notices

KnightWin Media Player's renderer and application code are licensed under GPL-3.0-only. Components listed below remain under their own licenses; their inclusion does not change those terms. This native Windows edition contains no Electron runtime.

## HLS.js 1.7.3

The bundled HLS playback asset is copied from the `hls.js` npm package. HLS.js is copyright Dailymotion and contributors and is licensed under Apache License 2.0. See [`LICENSES/HLS.JS-LICENSE.txt`](LICENSES/HLS.JS-LICENSE.txt) and [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).

Upstream: <https://github.com/video-dev/hls.js>

## TagLibSharp 2.3.0

TagLibSharp is used to read embedded audio cover art. It is licensed under LGPL-2.1-only; the license text is in [`LICENSES/LGPL-2.1.txt`](LICENSES/LGPL-2.1.txt).

Upstream: <https://github.com/mono/taglib-sharp>

## Microsoft WebView2 SDK

The native WPF host uses Microsoft's WebView2 SDK. Its SDK license and notices are included in [`LICENSES/MICROSOFT-WEBVIEW2-LICENSE.txt`](LICENSES/MICROSOFT-WEBVIEW2-LICENSE.txt) and [`LICENSES/MICROSOFT-WEBVIEW2-NOTICE.txt`](LICENSES/MICROSOFT-WEBVIEW2-NOTICE.txt). The Evergreen WebView2 Runtime is supplied by Windows/Microsoft and is not bundled with this application.

Upstream: <https://aka.ms/webview>

## .NET 8 runtime

The self-contained Windows executable includes the .NET 8 runtime. Microsoft .NET licensing and third-party notices are included in [`LICENSES/DOTNET-LICENSE.txt`](LICENSES/DOTNET-LICENSE.txt) and [`LICENSES/DOTNET-THIRD-PARTY-NOTICES.txt`](LICENSES/DOTNET-THIRD-PARTY-NOTICES.txt).

## TV directory data and streams

KnightWin Media Player does not host or control the TV channels or stream endpoints shown in the guide. The fallback catalog contains a small set of public directory records and third-party stream references; provider availability and terms vary. IPTV-Org is an independent community project and is not affiliated with KnightWin Media Player. See <https://github.com/iptv-org/iptv> and <https://github.com/iptv-org/database> for source data and licensing information.
