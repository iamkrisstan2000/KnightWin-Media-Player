using System.IO;
using System.Reflection;

namespace RevibeMediaCentre;

public partial class MainWindow
{
    private static string ResolveRendererRoot()
    {
        var besideExecutable = AppContext.BaseDirectory;
        if (File.Exists(Path.Combine(besideExecutable, "index.html"))) return besideExecutable;

        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "RevibeMediaCentre", "Renderer", $"KnightWin-{AppVersion}");
        var marker = Path.Combine(root, ".ready");
        if (File.Exists(Path.Combine(root, "index.html")) && File.Exists(marker)) return root;

        Directory.CreateDirectory(root);
        var assembly = Assembly.GetExecutingAssembly();
        const string prefix = "revibe/";
        var resources = assembly.GetManifestResourceNames().Where(name => name.StartsWith(prefix, StringComparison.Ordinal)).ToArray();
        foreach (var resourceName in resources)
        {
            var relative = resourceName[prefix.Length..].Replace('/', Path.DirectorySeparatorChar);
            if (relative.Split(Path.DirectorySeparatorChar).Any(segment => segment is ".." or ".")) continue;
            var destination = Path.GetFullPath(Path.Combine(root, relative));
            if (!destination.StartsWith(Path.GetFullPath(root) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) continue;
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            using var source = assembly.GetManifestResourceStream(resourceName);
            if (source is null) continue;
            using var output = File.Create(destination);
            source.CopyTo(output);
        }
        File.WriteAllText(marker, AppVersion);
        if (!File.Exists(Path.Combine(root, "index.html")))
            throw new FileNotFoundException("The embedded KnightWin Media Player renderer could not be extracted.");
        return root;
    }
}
