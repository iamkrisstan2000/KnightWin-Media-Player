using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Windows;

namespace RevibeMediaCentre;

public partial class App : Application
{
    private const string MutexName = "Local\\RevibeMediaCentre.Native.1";
    private const string PipeName = "RevibeMediaCentre.Native.1";
    private Mutex? _instanceMutex;
    private CancellationTokenSource? _pipeCancellation;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        bool createdNew;
        _instanceMutex = new Mutex(initiallyOwned: true, MutexName, out createdNew);
        if (!createdNew)
        {
            await ForwardToPrimaryInstanceAsync(e.Args);
            Shutdown();
            return;
        }

        var window = new MainWindow(e.Args);
        MainWindow = window;
        window.Show();
        StartPipeServer(window);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _pipeCancellation?.Cancel();
        try { _instanceMutex?.ReleaseMutex(); } catch { }
        _instanceMutex?.Dispose();
        base.OnExit(e);
    }

    private static async Task ForwardToPrimaryInstanceAsync(string[] args)
    {
        for (var attempt = 0; attempt < 15; attempt++)
        {
            try
            {
                await using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out, PipeOptions.Asynchronous);
                await client.ConnectAsync(350);
                await using var writer = new StreamWriter(client, new UTF8Encoding(false), leaveOpen: true);
                await writer.WriteLineAsync(JsonSerializer.Serialize(args));
                await writer.FlushAsync();
                return;
            }
            catch
            {
                await Task.Delay(100);
            }
        }
    }

    private void StartPipeServer(MainWindow window)
    {
        _pipeCancellation = new CancellationTokenSource();
        var token = _pipeCancellation.Token;
        _ = Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    await using var server = new NamedPipeServerStream(
                        PipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
                    await server.WaitForConnectionAsync(token);
                    using var reader = new StreamReader(server, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
                    var line = await reader.ReadLineAsync(token);
                    if (string.IsNullOrWhiteSpace(line)) continue;
                    var files = JsonSerializer.Deserialize<string[]>(line) ?? [];
                    await Dispatcher.InvokeAsync(() => window.ReceiveSecondInstanceRequest(files));
                }
                catch (OperationCanceledException) { break; }
                catch (IOException) { if (!token.IsCancellationRequested) await Task.Delay(100, token); }
                catch { if (!token.IsCancellationRequested) await Task.Delay(250, token); }
            }
        }, token);
    }
}
