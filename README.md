# KnightWin Media Player v1.0.0

**The official modern Windows successor to Revibe Media Centre.**

KnightWin continues Revibe’s local-first spirit in a native Windows app for your music, videos, and public TV streams. Your media files stay on your device, and your existing app settings remain in `%APPDATA%\Revibe Media Centre`.

## Download and run

1. Download `KnightWin-Media-Player-v1.0.0.exe` from the GitHub release.
2. Run it on **Windows 10 (build 19041 or later) or Windows 11, x64**.
3. If needed, install the free [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
4. Choose your music and video folders under **Settings → Media and Devices**.

## What’s included

- Local music and video libraries, queues, playback history, favorites, and artwork.
- Music visualizers, themes, equalizer, reverb, and crossfade.
- A public community TV guide; streams are provided by third parties and may change or be unavailable.
- Native Windows window controls, resizing, and fullscreen playback.

Optional online artwork search sends media titles and artist names to public search services; it never uploads your media files.

## Support the creator

Enjoying the player? A coffee helps Mr KNIGHT keep this independent project growing. Thank you for your support!

[![Support Mr KNIGHT on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/N7D7292WUD)

## Build from source

`KnightWin-Media-Player-v1.0.0-source.zip` contains the app source, assets, notices, and `BUILD-WINDOWS.ps1`. Build on Windows with the **.NET 8 SDK** and Microsoft WebView2 Runtime:

```powershell
.\BUILD-WINDOWS.ps1
```

## License

The application is free software under the **GNU General Public License v3 only (GPL-3.0-only)**. See [`LICENSE`](LICENSE). Third-party licenses and notices are included in [`LICENSES`](LICENSES/) and [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
