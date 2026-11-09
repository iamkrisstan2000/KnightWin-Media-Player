using System.Collections.Concurrent;
using System.IO;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;

namespace RevibeMediaCentre;

public partial class MainWindow
{
    private sealed record ScannedFile(string Path, long Size, long Modified);
    private readonly ConcurrentDictionary<string, string> _embeddedArtworkCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _mediaFilePathsByToken = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, Task<Dictionary<string, string>>> _sidecarArtworkCache = new(StringComparer.OrdinalIgnoreCase);
    private static readonly string[] ImageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
    private static readonly string[] SidecarArtworkNames = ["cover", "folder", "front", "albumart", "album", "artwork", "poster", "thumbnail", "thumb"];

    private async Task<object[]> ScanMediaFolderAsync(string folder, string kind)
    {
        if (string.IsNullOrWhiteSpace(folder) || !Path.IsPathRooted(folder) || !Directory.Exists(folder)) return [];
        var extensions = kind == "video" ? VideoExtensions : AudioExtensions;
        List<ScannedFile> scan;
        try { scan = await Task.Run(() => EnumerateMediaFiles(folder, extensions, maxFiles: 5000)); }
        catch { return []; }
        return await MakeMediaItemsAsync(scan.Select(file => file.Path), kind, scan.ToDictionary(file => file.Path, StringComparer.OrdinalIgnoreCase));
    }

    private static List<ScannedFile> EnumerateMediaFiles(string root, HashSet<string> extensions, int maxFiles)
    {
        var results = new List<ScannedFile>(Math.Min(maxFiles, 1024));
        var pending = new Stack<(string Directory, int Depth)>();
        pending.Push((Path.GetFullPath(root), 0));
        const int maxDepth = 7;

        while (pending.Count > 0 && results.Count < maxFiles)
        {
            var (directory, depth) = pending.Pop();
            if (depth > maxDepth) continue;
            FileSystemInfo[] entries;
            try { entries = new DirectoryInfo(directory).GetFileSystemInfos(); }
            catch { continue; }
            Array.Sort(entries, (left, right) => StringComparer.OrdinalIgnoreCase.Compare(left.Name, right.Name));

            // Push directories in reverse so traversal remains alphabetically stable.
            for (var index = entries.Length - 1; index >= 0 && results.Count < maxFiles; index--)
            {
                var entry = entries[index];
                if (entry.Name.StartsWith(".", StringComparison.Ordinal)) continue;
                try
                {
                    var attributes = entry.Attributes;
                    if ((attributes & FileAttributes.Hidden) != 0) continue;
                    if ((attributes & FileAttributes.Directory) != 0)
                    {
                        if ((attributes & FileAttributes.ReparsePoint) == 0 && depth < maxDepth)
                            pending.Push((entry.FullName, depth + 1));
                        continue;
                    }
                    if (!extensions.Contains(Path.GetExtension(entry.Name))) continue;
                    var info = new FileInfo(entry.FullName);
                    results.Add(new ScannedFile(info.FullName, info.Length, new DateTimeOffset(info.LastWriteTimeUtc).ToUnixTimeMilliseconds()));
                }
                catch { /* A locked, removed or unreadable item is skipped during scanning. */ }
            }
        }
        results.Sort((left, right) => right.Modified.CompareTo(left.Modified));
        return results;
    }

    private Task<object[]> MakeMediaItemsAsync(IEnumerable<string> paths, string kind, Dictionary<string, ScannedFile>? scanInfo = null)
    {
        var filePaths = paths.ToArray();
        return Task.Run<object[]>(() =>
        {
            var result = new List<object>();
            foreach (var rawPath in filePaths)
            {
                try
                {
                    var filePath = Path.GetFullPath(rawPath);
                    if (!File.Exists(filePath)) continue;
                    var extension = Path.GetExtension(filePath);
                    var allowed = kind == "video" ? VideoExtensions : AudioExtensions;
                    if (!allowed.Contains(extension)) continue;

                    var info = scanInfo is not null && scanInfo.TryGetValue(filePath, out var scanned) ? scanned : null;
                    var size = info?.Size ?? new FileInfo(filePath).Length;
                    var modified = info?.Modified ?? new DateTimeOffset(File.GetLastWriteTimeUtc(filePath)).ToUnixTimeMilliseconds();
                    var url = GetMediaUrlForFile(filePath);
                    if (string.IsNullOrWhiteSpace(url)) continue;

                    var basename = Path.GetFileNameWithoutExtension(filePath);
                    var title = Regex.Replace(basename, "[._]+", " ").Trim();
                    if (string.IsNullOrWhiteSpace(title)) title = basename;
                    var parentName = Path.GetFileName(Path.GetDirectoryName(filePath)?.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) ?? string.Empty);
                    var tags = ReadMediaSortTags(filePath);
                    var id = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(filePath.ToUpperInvariant()))).ToLowerInvariant();
                    result.Add(new
                    {
                        id,
                        title,
                        artist = string.IsNullOrWhiteSpace(tags.Artist) ? (string.IsNullOrWhiteSpace(parentName) ? "Local library" : parentName) : tags.Artist,
                        folder = parentName,
                        album = string.IsNullOrWhiteSpace(tags.Album) ? parentName : tags.Album,
                        year = tags.Year,
                        type = kind,
                        path = filePath,
                        url,
                        extension = extension.TrimStart('.').ToUpperInvariant(),
                        size,
                        modified
                    });
                }
                catch { /* The user can still add the remaining accessible files. */ }
            }
            return result.ToArray();
        });
    }

    private static (string Artist, string Album, uint Year) ReadMediaSortTags(string filePath)
    {
        try
        {
            using var media = TagLib.File.Create(filePath);
            var tag = media.Tag;
            var artist = tag.Performers?.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
            if (string.IsNullOrWhiteSpace(artist))
                artist = tag.AlbumArtists?.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
            return (artist.Trim(), tag.Album?.Trim() ?? string.Empty, tag.Year);
        }
        catch { return (string.Empty, string.Empty, 0); }
    }

    private string FileUrl(string filePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(filePath) || !Path.IsPathRooted(filePath)) return string.Empty;
            var absolute = Path.GetFullPath(filePath);
            if (!File.Exists(absolute)) return string.Empty;
            return GetMediaUrlForFile(absolute);
        }
        catch { return string.Empty; }
    }

    private string GetMediaUrlForFile(string filePath)
    {
        try
        {
            var fullFilePath = Path.GetFullPath(filePath);
            if (!File.Exists(fullFilePath)) return string.Empty;
            var token = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(fullFilePath.ToUpperInvariant()))).ToLowerInvariant();
            _mediaFilePathsByToken[token] = fullFilePath;
            return $"https://{MediaHostName}/__media/{token}/{Uri.EscapeDataString(Path.GetFileName(fullFilePath))}";
        }
        catch { return string.Empty; }
    }

    private void PublishLocalMediaResponse(Uri uri, int status, string contentType = "", string contentRange = "")
    {
        var response = new { url = uri.AbsoluteUri, status, contentType, contentRange };
        _ = Dispatcher.BeginInvoke(() => PublishEvent("mediaResponse", response));
    }

    private void HandleLocalMediaRequest(CoreWebView2WebResourceRequestedEventArgs e, Uri uri)
    {
        var environment = _webEnvironment;
        if (environment is null)
        {
            PublishLocalMediaResponse(uri, 503);
            return;
        }
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length < 2 || !segments[0].Equals("__media", StringComparison.OrdinalIgnoreCase) ||
            !_mediaFilePathsByToken.TryGetValue(segments[1], out var filePath) || !File.Exists(filePath))
        {
            e.Response = environment.CreateWebResourceResponse(null, 404, "Not Found", "Content-Length: 0");
            PublishLocalMediaResponse(uri, 404);
            return;
        }

        var method = e.Request.Method;
        if (method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase))
        {
            e.Response = environment.CreateWebResourceResponse(null, 204, "No Content",
                "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range, Content-Type\r\nContent-Length: 0");
            PublishLocalMediaResponse(uri, 204);
            return;
        }
        if (!method.Equals("GET", StringComparison.OrdinalIgnoreCase) && !method.Equals("HEAD", StringComparison.OrdinalIgnoreCase))
        {
            e.Response = environment.CreateWebResourceResponse(null, 405, "Method Not Allowed",
                "Allow: GET, HEAD, OPTIONS\r\nContent-Length: 0");
            PublishLocalMediaResponse(uri, 405);
            return;
        }

        try
        {
            var totalLength = new FileInfo(filePath).Length;
            var start = 0L;
            var end = totalLength - 1;
            var status = 200;
            var reason = "OK";
            string rangeHeader = string.Empty;
            try { rangeHeader = e.Request.Headers.GetHeader("Range"); } catch { /* no range requested */ }
            if (!string.IsNullOrWhiteSpace(rangeHeader))
            {
                if (!TryParseMediaByteRange(rangeHeader, totalLength, out start, out end))
                {
                    var unsatisfiedRange = $"bytes */{totalLength}";
                    e.Response = environment.CreateWebResourceResponse(null, 416, "Range Not Satisfiable",
                        $"Accept-Ranges: bytes\r\nContent-Range: {unsatisfiedRange}\r\nContent-Length: 0");
                    PublishLocalMediaResponse(uri, 416, GetLocalMediaContentType(filePath), unsatisfiedRange);
                    return;
                }
                status = 206;
                reason = "Partial Content";
            }

            var contentLength = totalLength == 0 ? 0 : end - start + 1;
            var contentType = GetLocalMediaContentType(filePath);
            var contentRange = status == 206 ? $"bytes {start}-{end}/{totalLength}" : string.Empty;
            var headers = new StringBuilder()
                .Append("Content-Type: ").Append(contentType).Append("\r\n")
                .Append("Content-Length: ").Append(contentLength.ToString(CultureInfo.InvariantCulture)).Append("\r\n")
                .Append("Accept-Ranges: bytes\r\nCache-Control: no-store\r\n")
                .Append("Access-Control-Allow-Origin: *\r\n")
                .Append("Access-Control-Expose-Headers: Accept-Ranges, Content-Length, Content-Range, Content-Type\r\n");
            if (status == 206) headers.Append("Content-Range: ").Append(contentRange).Append("\r\n");

            Stream? content = null;
            if (method.Equals("GET", StringComparison.OrdinalIgnoreCase) && contentLength > 0)
            {
                var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                content = new MediaRangeStream(fileStream, start, contentLength);
            }
            try
            {
                e.Response = environment.CreateWebResourceResponse(content, status, reason, headers.ToString());
                content = null; // WebView2 owns the response stream until it is consumed.
                PublishLocalMediaResponse(uri, status, contentType, contentRange);
            }
            catch
            {
                content?.Dispose();
                throw;
            }
        }
        catch (FileNotFoundException)
        {
            e.Response = environment.CreateWebResourceResponse(null, 404, "Not Found", "Content-Length: 0");
            PublishLocalMediaResponse(uri, 404);
        }
        catch (DirectoryNotFoundException)
        {
            e.Response = environment.CreateWebResourceResponse(null, 404, "Not Found", "Content-Length: 0");
            PublishLocalMediaResponse(uri, 404);
        }
        catch
        {
            e.Response = environment.CreateWebResourceResponse(null, 500, "Internal Server Error", "Content-Length: 0");
            PublishLocalMediaResponse(uri, 500);
        }
    }

    private static bool TryParseMediaByteRange(string header, long totalLength, out long start, out long end)
    {
        start = 0;
        end = -1;
        if (totalLength <= 0 || !header.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase)) return false;
        var value = header[6..].Trim();
        if (value.Contains(',')) return false;
        var dash = value.IndexOf('-');
        if (dash < 0 || value.IndexOf('-', dash + 1) >= 0) return false;
        var first = value[..dash].Trim();
        var last = value[(dash + 1)..].Trim();
        if (first.Length == 0)
        {
            if (!long.TryParse(last, NumberStyles.None, CultureInfo.InvariantCulture, out var suffixLength) || suffixLength <= 0) return false;
            start = Math.Max(0, totalLength - suffixLength);
            end = totalLength - 1;
            return true;
        }
        if (!long.TryParse(first, NumberStyles.None, CultureInfo.InvariantCulture, out start) || start < 0 || start >= totalLength) return false;
        if (last.Length == 0) end = totalLength - 1;
        else if (!long.TryParse(last, NumberStyles.None, CultureInfo.InvariantCulture, out end) || end < start) return false;
        end = Math.Min(end, totalLength - 1);
        return true;
    }

    private static string GetLocalMediaContentType(string filePath) => Path.GetExtension(filePath).ToLowerInvariant() switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".gif" => "image/gif",
        ".avif" => "image/avif",
        ".bmp" => "image/bmp",
        ".mp3" => "audio/mpeg",
        ".m4a" or ".alac" => "audio/mp4",
        ".aac" => "audio/aac",
        ".wav" => "audio/wav",
        ".flac" => "audio/flac",
        ".ogg" or ".oga" or ".opus" => "audio/ogg",
        ".wma" => "audio/x-ms-wma",
        ".aiff" or ".aif" => "audio/aiff",
        ".ape" => "audio/ape",
        ".mp4" or ".m4v" => "video/mp4",
        ".webm" => "video/webm",
        ".mkv" => "video/x-matroska",
        ".mov" => "video/quicktime",
        ".avi" => "video/x-msvideo",
        ".wmv" => "video/x-ms-wmv",
        ".mpeg" or ".mpg" => "video/mpeg",
        ".3gp" => "video/3gpp",
        ".ts" or ".m2ts" => "video/mp2t",
        _ => "application/octet-stream"
    };

    private sealed class MediaRangeStream : Stream
    {
        private FileStream? _file;
        private readonly long _start;
        private readonly long _length;
        private long _position;

        public MediaRangeStream(FileStream file, long start, long length)
        {
            _file = file;
            _start = start;
            _length = length;
            file.Position = start;
        }

        public override bool CanRead => _file?.CanRead == true;
        public override bool CanSeek => _file?.CanSeek == true;
        public override bool CanWrite => false;
        public override long Length => _length;
        public override long Position { get => _position; set => Seek(value, SeekOrigin.Begin); }
        public override void Flush() { }

        public override int Read(byte[] buffer, int offset, int count)
        {
            var file = _file;
            if (file is null || count == 0) return 0;
            if (_position >= _length) { Dispose(); return 0; }
            var read = file.Read(buffer, offset, (int)Math.Min(count, _length - _position));
            if (read == 0) { Dispose(); return 0; }
            _position += read;
            return read;
        }

        public override int Read(Span<byte> buffer)
        {
            var file = _file;
            if (file is null || buffer.Length == 0) return 0;
            if (_position >= _length) { Dispose(); return 0; }
            var read = file.Read(buffer[..(int)Math.Min(buffer.Length, _length - _position)]);
            if (read == 0) { Dispose(); return 0; }
            _position += read;
            return read;
        }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            var file = _file;
            if (file is null || buffer.Length == 0) return 0;
            if (_position >= _length) { Dispose(); return 0; }
            var read = await file.ReadAsync(buffer[..(int)Math.Min(buffer.Length, _length - _position)], cancellationToken).ConfigureAwait(false);
            if (read == 0) { Dispose(); return 0; }
            _position += read;
            return read;
        }

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
            ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

        public override long Seek(long offset, SeekOrigin origin)
        {
            var file = _file ?? throw new ObjectDisposedException(nameof(MediaRangeStream));
            var target = origin switch
            {
                SeekOrigin.Begin => offset,
                SeekOrigin.Current => _position + offset,
                SeekOrigin.End => _length + offset,
                _ => throw new ArgumentOutOfRangeException(nameof(origin))
            };
            if (target < 0 || target > _length) throw new IOException("Seek is outside the media response range.");
            file.Position = _start + target;
            _position = target;
            return target;
        }

        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            if (disposing) Interlocked.Exchange(ref _file, null)?.Dispose();
            base.Dispose(disposing);
        }
    }

    private async Task<string> GetMediaArtworkAsync(string filePath, string kind, bool refreshLocal = false, bool refreshSidecarIndex = false)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !Path.IsPathRooted(filePath) || !File.Exists(filePath)) return string.Empty;
        var sidecar = await FindSidecarArtworkAsync(filePath, refreshSidecarIndex);
        if (!string.IsNullOrEmpty(sidecar)) return FileUrl(sidecar);
        if (kind != "music" || !AudioExtensions.Contains(Path.GetExtension(filePath))) return string.Empty;
        return await Task.Run(() => GetEmbeddedArtwork(filePath, refreshLocal));
    }

    private async Task<string?> FindSidecarArtworkAsync(string mediaPath, bool refreshIndex = false)
    {
        try
        {
            var directory = Path.GetDirectoryName(mediaPath);
            if (string.IsNullOrEmpty(directory) || !Directory.Exists(directory)) return null;
            var key = Path.GetFullPath(directory);
            if (refreshIndex) _sidecarArtworkCache.TryRemove(key, out _);
            var indexTask = _sidecarArtworkCache.GetOrAdd(key, path => Task.Run(() => BuildSidecarArtworkIndex(path)));
            if (_sidecarArtworkCache.Count > 64)
            {
                foreach (var stale in _sidecarArtworkCache.Keys.Take(_sidecarArtworkCache.Count - 64)) _sidecarArtworkCache.TryRemove(stale, out _);
            }
            var byName = await indexTask;

            var names = new List<string> { Path.GetFileNameWithoutExtension(mediaPath) };
            names.AddRange(SidecarArtworkNames);
            foreach (var name in names)
            foreach (var extension in ImageExtensions)
                if (byName.TryGetValue(name + extension, out var match)) return match;
        }
        catch { }
        return null;
    }

    private static Dictionary<string, string> BuildSidecarArtworkIndex(string directory)
    {
        var byName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            foreach (var file in Directory.EnumerateFiles(directory))
            {
                if (byName.Count >= 4096) break;
                if (ImageExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase))
                    byName.TryAdd(Path.GetFileName(file), file);
            }
        }
        catch { }
        return byName;
    }

    private string GetEmbeddedArtwork(string filePath, bool refreshCache = false)
    {
        try
        {
            var info = new FileInfo(filePath);
            if (!info.Exists || info.Length > 1024L * 1024 * 1024) return string.Empty;
            var cacheKey = $"{info.FullName}|{info.Length}|{info.LastWriteTimeUtc.Ticks}";
            if (refreshCache) _embeddedArtworkCache.TryRemove(cacheKey, out _);
            if (_embeddedArtworkCache.TryGetValue(cacheKey, out var cached)) return cached;

            string result = string.Empty;
            using (var media = TagLib.File.Create(filePath))
            {
                var picture = media.Tag.Pictures.FirstOrDefault();
                var bytes = picture?.Data?.Data;
                var mime = (picture?.MimeType ?? string.Empty).ToLowerInvariant();
                var extension = mime switch
                {
                    "image/jpeg" or "image/jpg" => ".jpg",
                    "image/png" => ".png",
                    "image/webp" => ".webp",
                    "image/gif" => ".gif",
                    "image/avif" => ".avif",
                    _ => string.Empty
                };
                if (bytes is { Length: > 0 and <= 5242880 } && extension.Length > 0)
                {
                    var artworkDirectory = Path.Combine(_userDataRoot, "artwork-cache");
                    Directory.CreateDirectory(artworkDirectory);
                    var artworkPath = Path.Combine(artworkDirectory,
                        Convert.ToHexString(SHA1.HashData(bytes)).ToLowerInvariant() + extension);
                    if (!File.Exists(artworkPath)) File.WriteAllBytes(artworkPath, bytes);
                    result = GetMediaUrlForFile(artworkPath);
                }
            }

            if (_embeddedArtworkCache.Count > 512) _embeddedArtworkCache.Clear();
            _embeddedArtworkCache[cacheKey] = result;
            return result;
        }
        catch
        {
            return string.Empty;
        }
    }
}
