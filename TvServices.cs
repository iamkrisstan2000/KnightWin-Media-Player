using System.Net;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;

namespace RevibeMediaCentre;

public partial class MainWindow
{
    private sealed record TvStreamEntry(string Url, string? Referrer, string? UserAgent);
    private sealed record TvChannelEntry(string Id, string Name, string Country, string Logo, string Category, string[] Languages, TvStreamEntry[] Streams);
    private sealed record TvCatalogData(TvChannelEntry[] Channels, long FetchedAt, string Source, bool Stale = false, bool Cached = false, string? Error = null);

    private static readonly HttpClient TvHttpClient = CreateHttpClient();
    private static readonly Regex PlaylistUriAttribute = new("URI=\"([^\"]+)\"", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly string ChannelsApi = "https://iptv-org.github.io/api/channels.json";
    private static readonly string StreamsApi = "https://iptv-org.github.io/api/streams.json";
    private TvCatalogData? _tvCatalogCache;
    private long _tvCatalogCacheAt;

    private static HttpClient CreateHttpClient()
    {
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = true,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
        };
        return new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(35) };
    }

    private async Task<object> GetOpenTvCatalogAsync(bool force)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (!force && _tvCatalogCache is not null && now - _tvCatalogCacheAt < 8 * 60 * 1000)
            return _tvCatalogCache with { Cached = true, Stale = false, Error = null };

        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(25));
            var channelsTask = GetJsonAsync(ChannelsApi, timeout.Token);
            var streamsTask = GetJsonAsync(StreamsApi, timeout.Token);
            await Task.WhenAll(channelsTask, streamsTask);
            using var channelsDocument = channelsTask.Result;
            using var streamsDocument = streamsTask.Result;
            var channels = NormalizeCatalog(channelsDocument.RootElement, streamsDocument.RootElement);
            var catalog = new TvCatalogData(channels, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), "IPTV-Org");
            _tvCatalogCache = catalog;
            _tvCatalogCacheAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            try
            {
                Directory.CreateDirectory(_userDataRoot);
                await File.WriteAllTextAsync(Path.Combine(_userDataRoot, "open-tv-cache.json"), JsonSerializer.Serialize(catalog, JsonOptions));
            }
            catch { }
            return catalog with { Cached = false, Stale = false };
        }
        catch (Exception ex)
        {
            try
            {
                var cacheFile = Path.Combine(_userDataRoot, "open-tv-cache.json");
                if (File.Exists(cacheFile))
                {
                    var disk = JsonSerializer.Deserialize<TvCatalogData>(await File.ReadAllTextAsync(cacheFile), JsonOptions);
                    if (disk is { Channels.Length: > 0 })
                    {
                        _tvCatalogCache = disk;
                        _tvCatalogCacheAt = disk.FetchedAt;
                        return disk with { Cached = true, Stale = true, Error = ex.Message };
                    }
                }
            }
            catch { }

            var fallback = LoadFallbackTvCatalog();
            return new TvCatalogData(fallback, 0, "IPTV-Org cached starter guide", Stale: true, Cached: true, Error: ex.Message);
        }
    }

    private async Task<JsonDocument> GetJsonAsync(string url, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.UserAgent.ParseAdd($"KnightWinMediaPlayer/{AppVersion}");
        using var response = await TvHttpClient.SendAsync(request, HttpCompletionOption.ResponseContentRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonDocument.Parse(text);
    }

    private TvChannelEntry[] LoadFallbackTvCatalog()
    {
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(_contentRoot, "assets", "tv-fallback.json")));
            if (!document.RootElement.TryGetProperty("channels", out var channels) || channels.ValueKind != JsonValueKind.Array) return [];
            return ParseFallbackChannels(channels);
        }
        catch { return []; }
    }

    private static TvChannelEntry[] ParseFallbackChannels(JsonElement channels)
    {
        var result = new List<TvChannelEntry>();
        foreach (var channel in channels.EnumerateArray())
        {
            var id = GetString(channel, "id");
            var name = GetString(channel, "name");
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)) continue;
            var streams = new List<TvStreamEntry>();
            if (channel.TryGetProperty("streams", out var streamList) && streamList.ValueKind == JsonValueKind.Array)
            {
                foreach (var stream in streamList.EnumerateArray())
                {
                    var url = GetString(stream, "url");
                    if (!IsHttpUrl(url)) continue;
                    streams.Add(new TvStreamEntry(url, GetString(stream, "referrer"), GetString(stream, "userAgent")));
                    if (streams.Count == 3) break;
                }
            }
            if (streams.Count == 0) continue;
            result.Add(new TvChannelEntry(id, name, GetString(channel, "country"), GetString(channel, "logo"),
                string.IsNullOrWhiteSpace(GetString(channel, "category")) ? "general" : GetString(channel, "category"),
                GetStringArray(channel, "languages", 2), streams.ToArray()));
        }
        return result.ToArray();
    }

    private static TvChannelEntry[] NormalizeCatalog(JsonElement channelData, JsonElement streamData)
    {
        if (channelData.ValueKind != JsonValueKind.Array || streamData.ValueKind != JsonValueKind.Array) return [];
        var channelsById = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var channel in channelData.EnumerateArray())
        {
            var id = GetString(channel, "id");
            if (!string.IsNullOrWhiteSpace(id)) channelsById[id] = channel;
        }

        var grouped = new Dictionary<string, List<TvStreamEntry>>(StringComparer.Ordinal);
        foreach (var stream in streamData.EnumerateArray())
        {
            var id = GetString(stream, "channel");
            var url = GetString(stream, "url");
            if (!IsHttpUrl(url) || string.IsNullOrWhiteSpace(id) || !channelsById.TryGetValue(id, out var channel)) continue;
            if (GetBoolean(channel, "is_nsfw") || string.IsNullOrWhiteSpace(GetString(channel, "name"))) continue;
            if (!grouped.TryGetValue(id, out var bucket)) grouped[id] = bucket = [];
            if (bucket.Count >= 3 || bucket.Any(entry => entry.Url.Equals(url, StringComparison.OrdinalIgnoreCase))) continue;
            bucket.Add(new TvStreamEntry(url, GetString(stream, "http_referrer"), GetString(stream, "user_agent")));
        }

        var result = new List<TvChannelEntry>();
        foreach (var pair in grouped)
        {
            if (!channelsById.TryGetValue(pair.Key, out var channel) || pair.Value.Count == 0) continue;
            var name = GetString(channel, "name");
            if (name.Length > 110) name = name[..110];
            var logo = GetString(channel, "logo");
            if (!IsHttpUrl(logo)) logo = string.Empty;
            var categories = GetStringArray(channel, "categories", 1);
            var category = categories.Length == 0 ? "general" : categories[0].Replace('_', ' ');
            result.Add(new TvChannelEntry(pair.Key, name, GetString(channel, "country"), logo, category,
                GetStringArray(channel, "languages", 2), pair.Value.ToArray()));
        }

        return result.OrderByDescending(channel => channel.Country == "PH")
            .ThenBy(channel => CategoryRank(channel.Category))
            .ThenBy(channel => channel.Name, StringComparer.CurrentCultureIgnoreCase)
            .Take(240).ToArray();
    }

    private async Task<string> SearchArtworkAsync(JsonElement item)
    {
        if (item.ValueKind != JsonValueKind.Object) return string.Empty;
        var title = GetString(item, "title");
        if (string.IsNullOrWhiteSpace(title)) title = GetString(item, "name");
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;
        var kind = GetString(item, "type");

        try
        {
            if (kind == "tv")
            {
                var url = "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrnamespace=0&gsrlimit=5&prop=pageimages&piprop=thumbnail&pithumbsize=320&format=json&gsrsearch=" + Uri.EscapeDataString(title + " television channel");
                using var document = await FetchJsonDocumentAsync(url, TimeSpan.FromSeconds(9));
                if (!document.RootElement.TryGetProperty("query", out var query) || !query.TryGetProperty("pages", out var pages) || pages.ValueKind != JsonValueKind.Object)
                    return string.Empty;
                var target = NormalizeLookupText(title);
                var matches = new List<(string Title, string Image)>();
                foreach (var page in pages.EnumerateObject())
                {
                    var pageTitle = GetString(page.Value, "title");
                    var image = page.Value.TryGetProperty("thumbnail", out var thumb) ? GetString(thumb, "source") : string.Empty;
                    var normalized = NormalizeLookupText(pageTitle);
                    if (IsHttpUrl(image) && normalized.Length > 0 && (normalized.Contains(target, StringComparison.Ordinal) || target.Contains(normalized, StringComparison.Ordinal)))
                        matches.Add((pageTitle, image));
                }
                return matches.OrderByDescending(match => NormalizeLookupText(match.Title) == target).Select(match => match.Image).FirstOrDefault() ?? string.Empty;
            }

            var artist = GetString(item, "artist");
            if (artist is "Local library" or "Unknown Artist") artist = string.Empty;
            var term = string.Join(' ', new[] { title, artist }.Where(part => !string.IsNullOrWhiteSpace(part)));
            if (string.IsNullOrWhiteSpace(term)) return string.Empty;
            var entity = kind == "video" ? "movie" : "song";
            var searchUrl = $"https://itunes.apple.com/search?term={Uri.EscapeDataString(term)}&entity={entity}&limit=8";
            using var result = await FetchJsonDocumentAsync(searchUrl, TimeSpan.FromSeconds(9));
            if (!result.RootElement.TryGetProperty("results", out var entries) || entries.ValueKind != JsonValueKind.Array) return string.Empty;
            var normalizedTitle = NormalizeLookupText(title);
            var normalizedArtist = NormalizeLookupText(artist);
            var ranked = new List<(int Score, string Artwork)>();
            foreach (var entry in entries.EnumerateArray())
            {
                var artwork = GetString(entry, "artworkUrl600");
                if (string.IsNullOrEmpty(artwork)) artwork = GetString(entry, "artworkUrl100");
                if (string.IsNullOrEmpty(artwork)) artwork = GetString(entry, "artworkUrl60");
                if (string.IsNullOrEmpty(artwork)) continue;
                var candidateTitle = NormalizeLookupText(GetString(entry, "trackName"));
                if (string.IsNullOrEmpty(candidateTitle)) candidateTitle = NormalizeLookupText(GetString(entry, "collectionName"));
                var candidateArtist = NormalizeLookupText(GetString(entry, "artistName"));
                var score = candidateTitle == normalizedTitle ? 10 : candidateTitle.Contains(normalizedTitle, StringComparison.Ordinal) || normalizedTitle.Contains(candidateTitle, StringComparison.Ordinal) ? 5 : 0;
                if (!string.IsNullOrEmpty(normalizedArtist) && !string.IsNullOrEmpty(candidateArtist) &&
                    (candidateArtist.Contains(normalizedArtist, StringComparison.Ordinal) || normalizedArtist.Contains(candidateArtist, StringComparison.Ordinal))) score += 3;
                ranked.Add((score, Regex.Replace(artwork, "\\d+x\\d+bb", "600x600bb", RegexOptions.IgnoreCase)));
            }
            return ranked.OrderByDescending(match => match.Score).Where(match => match.Score >= 5).Select(match => match.Artwork).FirstOrDefault() ?? string.Empty;
        }
        catch { return string.Empty; }
    }

    private static async Task<JsonDocument> FetchJsonDocumentAsync(string url, TimeSpan timeout)
    {
        using var cancel = new CancellationTokenSource(timeout);
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd($"KnightWinMediaPlayer/{AppVersion}");
        using var response = await TvHttpClient.SendAsync(request, HttpCompletionOption.ResponseContentRead, cancel.Token);
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancel.Token));
    }

    private void Core_WebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (!Uri.TryCreate(e.Request.Uri, UriKind.Absolute, out var uri)) return;
        if (uri.Host.Equals(MediaHostName, StringComparison.OrdinalIgnoreCase) &&
            uri.AbsolutePath.StartsWith("/__media/", StringComparison.OrdinalIgnoreCase))
        {
            HandleLocalMediaRequest(e, uri);
            return;
        }
        if (!uri.Host.Equals(ProxyHostName, StringComparison.OrdinalIgnoreCase)) return;
        _ = HandleProxyRequestAsync(e);
    }

    private async Task HandleProxyRequestAsync(CoreWebView2WebResourceRequestedEventArgs e)
    {
        var deferral = e.GetDeferral();
        try
        {
            var response = await FetchProxyResponseAsync(e.Request);
            if (_webEnvironment is not null)
                e.Response = _webEnvironment.CreateWebResourceResponse(new MemoryStream(response.Body), response.Status, response.Reason, response.Headers);
        }
        catch (Exception ex)
        {
            if (_webEnvironment is not null)
            {
                var bytes = Encoding.UTF8.GetBytes($"TV stream proxy error: {ex.Message}");
                e.Response = _webEnvironment.CreateWebResourceResponse(new MemoryStream(bytes), 502, "Bad Gateway", BuildCorsHeaders("text/plain; charset=utf-8"));
            }
        }
        finally { deferral.Complete(); }
    }

    private async Task<ProxyResponse> FetchProxyResponseAsync(CoreWebView2WebResourceRequest request)
    {
        var proxyUri = new Uri(request.Uri);
        var query = ParseQuery(proxyUri.Query);
        if (!query.TryGetValue("url", out var rawUrl) || !Uri.TryCreate(rawUrl, UriKind.Absolute, out var target) || !IsHttpUrl(target.AbsoluteUri))
            return new ProxyResponse(400, "Bad Request", "Missing or invalid stream URL"u8.ToArray(), BuildCorsHeaders("text/plain; charset=utf-8"));

        if (request.Method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase))
            return new ProxyResponse(204, "No Content", [], BuildCorsHeaders("text/plain"));

        var method = request.Method.Equals("HEAD", StringComparison.OrdinalIgnoreCase) ? HttpMethod.Head : HttpMethod.Get;
        using var outgoing = new HttpRequestMessage(method, target);
        if (query.TryGetValue("ref", out var referrer) && Uri.TryCreate(referrer, UriKind.Absolute, out var referrerUri))
            outgoing.Headers.Referrer = referrerUri;
        if (query.TryGetValue("ua", out var userAgent) && !string.IsNullOrWhiteSpace(userAgent))
            outgoing.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        else
            outgoing.Headers.UserAgent.ParseAdd($"KnightWinMediaPlayer/{AppVersion}");
        try
        {
            var range = request.Headers.GetHeader("Range");
            if (!string.IsNullOrWhiteSpace(range) && RangeHeaderValue.TryParse(range, out var parsedRange)) outgoing.Headers.Range = parsedRange;
        }
        catch { }
        try
        {
            var accept = request.Headers.GetHeader("Accept");
            if (!string.IsNullOrWhiteSpace(accept)) outgoing.Headers.TryAddWithoutValidation("Accept", accept);
        }
        catch { }

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(65));
        using var response = await TvHttpClient.SendAsync(outgoing, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
        byte[] body = request.Method.Equals("HEAD", StringComparison.OrdinalIgnoreCase)
            ? Array.Empty<byte>() : await response.Content.ReadAsByteArrayAsync(timeout.Token);
        var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
        var finalUri = response.RequestMessage?.RequestUri ?? target;
        var playlist = IsPlaylist(contentType, finalUri, body);
        var isPlaylistBody = false;

        if (playlist && body.Length > 0 && !request.Method.Equals("HEAD", StringComparison.OrdinalIgnoreCase))
        {
            var text = Encoding.UTF8.GetString(body);
            if (text.TrimStart('\uFEFF', ' ', '\t', '\r', '\n').StartsWith("#EXTM3U", StringComparison.Ordinal))
            {
                var rewritten = RewritePlaylist(text, finalUri, query.GetValueOrDefault("ref"), query.GetValueOrDefault("ua"));
                body = Encoding.UTF8.GetBytes(rewritten);
                contentType = "application/vnd.apple.mpegurl; charset=utf-8";
                isPlaylistBody = true;
            }
        }

        var headers = BuildCorsHeaders(contentType);
        if (!isPlaylistBody)
        {
            if (response.Headers.AcceptRanges.Contains("bytes")) headers += "Accept-Ranges: bytes\r\n";
            if (response.Content.Headers.ContentRange is { } contentRange) headers += $"Content-Range: {contentRange}\r\n";
            if (body.Length > 0 || request.Method.Equals("HEAD", StringComparison.OrdinalIgnoreCase)) headers += $"Content-Length: {body.Length}\r\n";
        }
        if (response.Headers.TryGetValues("ETag", out var etags)) headers += $"ETag: {etags.First()}\r\n";
        if (response.Content.Headers.LastModified is { } lastModified) headers += $"Last-Modified: {lastModified:R}\r\n";
        return new ProxyResponse((int)response.StatusCode, response.ReasonPhrase ?? "OK", body, headers);
    }

    private static string RewritePlaylist(string playlist, Uri baseUri, string? referrer, string? userAgent)
    {
        return string.Join('\n', playlist.Split('\n').Select(line =>
        {
            var trimmed = line.TrimEnd('\r');
            if (string.IsNullOrWhiteSpace(trimmed)) return trimmed;
            if (trimmed.TrimStart().StartsWith('#'))
            {
                return PlaylistUriAttribute.Replace(trimmed, match =>
                {
                    if (!Uri.TryCreate(baseUri, match.Groups[1].Value, out var nested) || !IsHttpUrl(nested.AbsoluteUri)) return match.Value;
                    return "URI=\"" + BuildProxyUrl(nested, referrer, userAgent) + "\"";
                });
            }
            if (!Uri.TryCreate(baseUri, trimmed.Trim(), out var resolved) || !IsHttpUrl(resolved.AbsoluteUri)) return trimmed;
            return BuildProxyUrl(resolved, referrer, userAgent);
        }));
    }

    private static string BuildProxyUrl(Uri target, string? referrer, string? userAgent)
    {
        var query = new List<string> { "url=" + Uri.EscapeDataString(target.AbsoluteUri) };
        if (!string.IsNullOrWhiteSpace(referrer)) query.Add("ref=" + Uri.EscapeDataString(referrer));
        if (!string.IsNullOrWhiteSpace(userAgent)) query.Add("ua=" + Uri.EscapeDataString(userAgent));
        return $"https://{ProxyHostName}/?{string.Join('&', query)}";
    }

    private static string BuildCorsHeaders(string contentType)
    {
        return "Access-Control-Allow-Origin: *\r\n" +
               "Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n" +
               "Access-Control-Allow-Headers: Range, Origin, Accept, Content-Type, User-Agent, Referer\r\n" +
               "Access-Control-Expose-Headers: Accept-Ranges, Content-Length, Content-Range, Content-Type\r\n" +
               "Cross-Origin-Resource-Policy: cross-origin\r\n" +
               "Cache-Control: no-store\r\n" +
               $"Content-Type: {contentType}\r\n";
    }

    private static bool IsPlaylist(string contentType, Uri url, byte[] body)
    {
        if (contentType.Contains("mpegurl", StringComparison.OrdinalIgnoreCase) ||
            url.AbsolutePath.EndsWith(".m3u", StringComparison.OrdinalIgnoreCase) ||
            url.AbsolutePath.EndsWith(".m3u8", StringComparison.OrdinalIgnoreCase)) return true;
        if (body.Length == 0 || body.Length > 1024 * 1024) return false;
        var header = Encoding.UTF8.GetString(body.AsSpan(0, Math.Min(body.Length, 128)));
        return header.TrimStart('\uFEFF', ' ', '\t', '\r', '\n').StartsWith("#EXTM3U", StringComparison.Ordinal);
    }

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var part in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var split = part.Split('=', 2);
            var key = Uri.UnescapeDataString(split[0].Replace('+', ' '));
            var value = split.Length > 1 ? Uri.UnescapeDataString(split[1].Replace('+', ' ')) : string.Empty;
            result[key] = value;
        }
        return result;
    }

    private static string NormalizeLookupText(string value)
    {
        var decomposed = value.ToLowerInvariant().Normalize(NormalizationForm.FormKD);
        var builder = new StringBuilder(decomposed.Length);
        var space = true;
        foreach (var character in decomposed)
        {
            if (char.GetUnicodeCategory(character) == System.Globalization.UnicodeCategory.NonSpacingMark) continue;
            if (char.IsAsciiLetterOrDigit(character)) { builder.Append(character); space = false; }
            else if (!space) { builder.Append(' '); space = true; }
        }
        return builder.ToString().Trim();
    }

    private static bool IsHttpUrl(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);
    }

    private static int CategoryRank(string category) => category.ToLowerInvariant() switch
    {
        "news" => 0,
        "sports" => 1,
        "entertainment" => 2,
        "general" => 3,
        "music" => 4,
        "education" => 5,
        "culture" => 6,
        _ => 8
    };

    private static bool GetBoolean(JsonElement element, string property)
    {
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var value) &&
               (value.ValueKind == JsonValueKind.True || (value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out var parsed) && parsed));
    }

    private static string[] GetStringArray(JsonElement element, string property, int limit)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Array) return [];
        return value.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String)
            .Select(item => item.GetString() ?? string.Empty).Where(item => !string.IsNullOrWhiteSpace(item)).Take(limit).ToArray();
    }

    private sealed record ProxyResponse(int Status, string Reason, byte[] Body, string Headers);
}
