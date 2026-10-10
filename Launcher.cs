using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

namespace StreamPulse
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            int port = 3000;

            // 1. Cek apakah server port 3000 sudah berjalan
            bool isServerRunning = false;
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(400);
                    if (success && client.Connected)
                    {
                        client.EndConnect(result);
                        isServerRunning = true;
                    }
                }
            }
            catch { }

            // 2. Jika belum jalan, jalankan node server.js di background secara tersembunyi
            if (!isServerRunning)
            {
                string serverScript = Path.Combine(baseDir, "server.js");
                if (File.Exists(serverScript))
                {
                    ProcessStartInfo psiNode = new ProcessStartInfo
                    {
                        FileName = "node",
                        Arguments = "--max-old-space-size=48 \"" + serverScript + "\"",
                        WorkingDirectory = baseDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    try
                    {
                        Process.Start(psiNode);
                        Thread.Sleep(1000); // Tunggu 1 detik agar server siap
                    }
                    catch { }
                }
            }

            // 3. Cari Microsoft Edge untuk membuka dalam mode Windows Native App (RAM ~40MB)
            string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            if (!File.Exists(edgePath))
            {
                edgePath = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
            }

            string appUrl = "http://localhost:" + port + "/?lite=1";

            if (File.Exists(edgePath))
            {
                ProcessStartInfo psiEdge = new ProcessStartInfo
                {
                    FileName = edgePath,
                    Arguments = "--app=" + appUrl + " --window-size=1360,840 --mute-audio",
                    UseShellExecute = true
                };
                Process.Start(psiEdge);
            }
            else
            {
                // Fallback jika Edge tidak ditemukan: buka di default browser
                Process.Start(new ProcessStartInfo(appUrl) { UseShellExecute = true });
            }
        }
    }
}
