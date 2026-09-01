using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

[assembly: AssemblyTitle("Cogito")]
[assembly: AssemblyProduct("Cogito Web UI")]
[assembly: AssemblyDescription("Cogito AI Assistant Background Service")]
[assembly: AssemblyCompany("Cogito")]
[assembly: AssemblyCopyright("Copyright © 2026 Cogito")]
[assembly: AssemblyVersion("0.1.0.0")]
[assembly: AssemblyFileVersion("0.1.0.0")]

namespace CogitoTray
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string logFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tray.log");

            // Ensure only one tray process runs: replace any older instance
            try
            {
                Process current = Process.GetCurrentProcess();
                Process[] procs = Process.GetProcessesByName(current.ProcessName);
                foreach (Process p in procs)
                {
                    if (p.Id != current.Id)
                    {
                        try
                        {
                            p.Kill();
                            p.WaitForExit(500);
                        }
                        catch { }
                    }
                }
            }
            catch { }

            try
            {
                File.WriteAllText(logFile, "Starting at " + DateTime.Now.ToString() + "\nArgs: " + string.Join(" ", args) + "\n");

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                    int port = 2648;
                    int serverPid = 0;
                    string projectRoot = "";

                    foreach (var arg in args)
                    {
                        if (arg.StartsWith("/port:"))
                        {
                            int.TryParse(arg.Substring(6), out port);
                        }
                        else if (arg.StartsWith("/pid:"))
                        {
                            int.TryParse(arg.Substring(5), out serverPid);
                        }
                        else if (arg.StartsWith("/root:"))
                        {
                            projectRoot = arg.Substring(6).Trim('"');
                        }
                    }

                    if (string.IsNullOrEmpty(projectRoot))
                    {
                        projectRoot = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
                    }

                var app = new CogitoTrayApp(port, serverPid, projectRoot, logFile);
                File.AppendAllText(logFile, "Entering Application.Run...\n");
                Application.Run(app);
                File.AppendAllText(logFile, "Application.Run exited cleanly at " + DateTime.Now.ToString() + "\n");
            }
            catch (Exception ex)
            {
                try { File.AppendAllText(logFile, "FATAL EXCEPTION: " + ex.ToString() + "\n"); } catch { }
            }
        }
    }

    public class CogitoTrayApp : Form
    {
        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private NotifyIcon trayIcon;
        private int port;
        private int serverPid;
        private string projectRoot;
        private string webUrl;
        private string logFile;

        public CogitoTrayApp(int port, int serverPid, string projectRoot, string logFile)
        {
            this.port = port;
            this.serverPid = serverPid;
            this.projectRoot = projectRoot;
            this.logFile = logFile;
            this.webUrl = "http://localhost:" + port;

            this.WindowState = FormWindowState.Minimized;
            this.ShowInTaskbar = false;
            this.FormBorderStyle = FormBorderStyle.None;
            this.Size = new Size(0, 0);
            this.Opacity = 0;
            this.Location = new Point(-2000, -2000);

            trayIcon = new NotifyIcon();
            trayIcon.Text = "Cogito Web UI (" + webUrl + ")";

            string iconPath = Path.Combine(projectRoot, "src", "app", "tray-icon.png");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(projectRoot, "src", "app", "icon.png");
            }

            Image menuAppIcon = null;

            try
            {
                if (File.Exists(iconPath))
                {
                    using (Bitmap srcBmp = new Bitmap(iconPath))
                    {
                        using (Bitmap trayBmp = new Bitmap(32, 32, System.Drawing.Imaging.PixelFormat.Format32bppArgb))
                        using (Graphics g = Graphics.FromImage(trayBmp))
                        {
                            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            g.SmoothingMode = SmoothingMode.HighQuality;
                            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                            g.DrawImage(srcBmp, 0, 0, 32, 32);
                            IntPtr hIcon = trayBmp.GetHicon();
                            trayIcon.Icon = Icon.FromHandle(hIcon);
                        }

                        menuAppIcon = new Bitmap(18, 18, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                        using (Graphics g = Graphics.FromImage(menuAppIcon))
                        {
                            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            g.SmoothingMode = SmoothingMode.HighQuality;
                            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                            g.DrawImage(srcBmp, 0, 0, 18, 18);
                        }
                        File.AppendAllText(logFile, "Loaded custom tray icon successfully\n");
                    }
                }
                else
                {
                    trayIcon.Icon = SystemIcons.Application;
                }
            }
            catch (Exception ex)
            {
                File.AppendAllText(logFile, "Icon load exception: " + ex.Message + "\n");
                trayIcon.Icon = SystemIcons.Application;
            }

            ContextMenuStrip contextMenu = new ContextMenuStrip();
            contextMenu.ShowImageMargin = false;
            contextMenu.ShowCheckMargin = false;
            contextMenu.ImageScalingSize = new Size(18, 18);
            contextMenu.Renderer = new ModernDarkRenderer();
            contextMenu.BackColor = Color.FromArgb(28, 28, 32);
            contextMenu.Padding = new Padding(4, 5, 4, 5);
            contextMenu.Font = new Font("Segoe UI", 9.25f, FontStyle.Regular);

            // Enable Windows 11 DWM rounded corners
            contextMenu.HandleCreated += (s, e) => {
                try
                {
                    int round = 2; // DWMWCP_ROUND
                    DwmSetWindowAttribute(contextMenu.Handle, 33, ref round, sizeof(int));
                }
                catch { }
            };

            // 1. Top item: App Icon + Cogito
            ToolStripMenuItem appItem = new ToolStripMenuItem("Cogito");
            if (menuAppIcon != null)
            {
                appItem.Image = menuAppIcon;
            }
            appItem.AutoSize = false;
            appItem.Size = new Size(160, 32);
            appItem.ForeColor = Color.FromArgb(235, 235, 240);
            appItem.Click += (s, e) => OpenBrowser();
            contextMenu.Items.Add(appItem);

            contextMenu.Items.Add(new ToolStripSeparator());

            // 2. Restart Server
            ToolStripMenuItem restartItem = new ToolStripMenuItem("Restart Server");
            restartItem.AutoSize = false;
            restartItem.Size = new Size(160, 32);
            restartItem.ForeColor = Color.FromArgb(235, 235, 240);
            restartItem.Click += (s, e) => {
                trayIcon.ShowBalloonTip(1800, "Cogito", "Restarting server...", ToolTipIcon.Info);
                string cogitoBin = Path.Combine(projectRoot, "bin", "cogito.js");
                ProcessStartInfo psi = new ProcessStartInfo("node", "\"" + cogitoBin + "\" restart")
                {
                    WindowStyle = ProcessWindowStyle.Hidden,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                try { Process.Start(psi); } catch { }
            };
            contextMenu.Items.Add(restartItem);

            contextMenu.Items.Add(new ToolStripSeparator());

            // 3. Exit
            ToolStripMenuItem exitItem = new ToolStripMenuItem("Exit");
            exitItem.AutoSize = false;
            exitItem.Size = new Size(160, 32);
            exitItem.ForeColor = Color.FromArgb(235, 235, 240);
            exitItem.Click += (s, e) => {
                trayIcon.Visible = false;
                if (serverPid > 0)
                {
                    try { Process.GetProcessById(serverPid).Kill(); } catch { }
                }
                string cogitoBin = Path.Combine(projectRoot, "bin", "cogito.js");
                ProcessStartInfo psi = new ProcessStartInfo("node", "\"" + cogitoBin + "\" stop")
                {
                    WindowStyle = ProcessWindowStyle.Hidden,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                this.Close();
                Application.Exit();
            };
            contextMenu.Items.Add(exitItem);

            trayIcon.ContextMenuStrip = contextMenu;
            trayIcon.Visible = true;

            trayIcon.MouseClick += (s, e) => {
                if (e.Button == MouseButtons.Left)
                {
                    OpenBrowser();
                }
            };

            File.AppendAllText(logFile, "Tray icon is set to visible.\n");
        }

        private long lastOpenTime = 0;
        private void OpenBrowser()
        {
            long now = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;
            if (now - lastOpenTime < 1500)
            {
                return; // Prevent opening multiple browser tabs simultaneously
            }
            lastOpenTime = now;

            try
            {
                Process.Start(new ProcessStartInfo(webUrl) { UseShellExecute = true });
            }
            catch { }
        }
    }

    public class ModernDarkColorTable : ProfessionalColorTable
    {
        public override Color ToolStripDropDownBackground
        {
            get { return Color.FromArgb(28, 28, 32); }
        }
        public override Color ImageMarginGradientBegin
        {
            get { return Color.FromArgb(28, 28, 32); }
        }
        public override Color ImageMarginGradientMiddle
        {
            get { return Color.FromArgb(28, 28, 32); }
        }
        public override Color ImageMarginGradientEnd
        {
            get { return Color.FromArgb(28, 28, 32); }
        }
        public override Color MenuBorder
        {
            get { return Color.FromArgb(48, 48, 54); }
        }
        public override Color MenuItemBorder
        {
            get { return Color.Transparent; }
        }
        public override Color MenuItemSelected
        {
            get { return Color.FromArgb(48, 49, 54); }
        }
        public override Color MenuItemSelectedGradientBegin
        {
            get { return Color.FromArgb(48, 49, 54); }
        }
        public override Color MenuItemSelectedGradientEnd
        {
            get { return Color.FromArgb(48, 49, 54); }
        }
        public override Color SeparatorDark
        {
            get { return Color.FromArgb(44, 44, 50); }
        }
        public override Color SeparatorLight
        {
            get { return Color.FromArgb(44, 44, 50); }
        }
    }

    public class ModernDarkRenderer : ToolStripProfessionalRenderer
    {
        public ModernDarkRenderer() : base(new ModernDarkColorTable())
        {
        }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (e.Item.Selected && e.Item.Enabled)
            {
                Rectangle rc = new Rectangle(3, 1, e.Item.Width - 6, e.Item.Height - 2);
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath path = CreateRoundedRect(rc, 4))
                using (SolidBrush bgBrush = new SolidBrush(Color.FromArgb(50, 52, 58)))
                {
                    e.Graphics.FillPath(bgBrush, path);
                }
            }
        }

        protected override void OnRenderItemImage(ToolStripItemImageRenderEventArgs e)
        {
            if (e.Image != null)
            {
                int imgSize = 18;
                int imgX = 12;
                int imgY = (e.Item.Height - imgSize) / 2;
                Rectangle imgRect = new Rectangle(imgX, imgY, imgSize, imgSize);

                e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
                e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                e.Graphics.DrawImage(e.Image, imgRect);
            }
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            // Draw image directly to ensure it always renders
            if (e.Item.Image != null)
            {
                int imgSize = 18;
                int imgX = 12;
                int imgY = (e.Item.Height - imgSize) / 2;
                Rectangle imgRect = new Rectangle(imgX, imgY, imgSize, imgSize);

                e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
                e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                e.Graphics.DrawImage(e.Item.Image, imgRect);
            }

            Color textColor = e.Item.Selected ? Color.White : Color.FromArgb(230, 230, 235);
            if (!e.Item.Enabled) textColor = Color.FromArgb(120, 120, 125);

            int textX = (e.Item.Image != null) ? 38 : 14;
            Rectangle textRect = new Rectangle(textX, 0, e.Item.Width - textX - 8, e.Item.Height);

            using (SolidBrush brush = new SolidBrush(textColor))
            using (StringFormat sf = new StringFormat())
            {
                sf.LineAlignment = StringAlignment.Center;
                sf.Alignment = StringAlignment.Near;
                sf.FormatFlags = StringFormatFlags.NoWrap;
                e.Graphics.DrawString(e.Text, e.TextFont, brush, textRect, sf);
            }
        }

        protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
        {
            int y = e.Item.Height / 2;
            using (Pen pen = new Pen(Color.FromArgb(44, 44, 50)))
            {
                e.Graphics.DrawLine(pen, 8, y, e.Item.Width - 8, y);
            }
        }

        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
        {
            Rectangle rc = new Rectangle(0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
            using (Pen pen = new Pen(Color.FromArgb(48, 48, 54)))
            {
                e.Graphics.DrawRectangle(pen, rc);
            }
        }

        private static GraphicsPath CreateRoundedRect(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            if (d > rect.Width) d = rect.Width;
            if (d > rect.Height) d = rect.Height;

            Rectangle arc = new Rectangle(rect.X, rect.Y, d, d);
            path.AddArc(arc, 180, 90);

            arc.X = rect.Right - d;
            path.AddArc(arc, 270, 90);

            arc.Y = rect.Bottom - d;
            path.AddArc(arc, 0, 90);

            arc.X = rect.Left;
            path.AddArc(arc, 90, 90);

            path.CloseFigure();
            return path;
        }
    }
}
