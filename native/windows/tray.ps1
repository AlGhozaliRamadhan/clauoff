param(
    [int]$Port = 2648,
    [int]$ServerPid = 0,
    [string]$ProjectRoot = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$url = "http://localhost:$Port"
$iconPath = Join-Path $ProjectRoot "src\app\tray-icon.png"
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $ProjectRoot "src\app\icon.png"
}

# Create a hidden dummy form that anchors the Win32 message loop
$hiddenForm = New-Object System.Windows.Forms.Form
$hiddenForm.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$hiddenForm.ShowInTaskbar = $false
$hiddenForm.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$hiddenForm.Opacity = 0
$hiddenForm.Size = New-Object System.Drawing.Size(0, 0)
$hiddenForm.Location = New-Object System.Drawing.Point(-2000, -2000)

# Create NotifyIcon
$notify = New-Object System.Windows.Forms.NotifyIcon

try {
    if (Test-Path $iconPath) {
        $rawBmp = [System.Drawing.Bitmap]::FromFile($iconPath)
        $trayBmp = New-Object System.Drawing.Bitmap(32, 32, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($trayBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($rawBmp, 0, 0, 32, 32)
        $g.Dispose()
        $rawBmp.Dispose()

        $hIcon = $trayBmp.GetHicon()
        $notify.Icon = [System.Drawing.Icon]::FromHandle($hIcon)
    } else {
        $notify.Icon = [System.Drawing.SystemIcons]::Application
    }
} catch {
    $notify.Icon = [System.Drawing.SystemIcons]::Application
}

$notify.Text = "Cogito Web UI ($url)"
$notify.Visible = $true

# Context Menu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$contextMenu.ShowImageMargin = $false
$contextMenu.ShowCheckMargin = $false
$contextMenu.ImageScalingSize = New-Object System.Drawing.Size(18, 18)
$contextMenu.BackColor = [System.Drawing.Color]::FromArgb(28, 28, 32)
$contextMenu.Padding = New-Object System.Windows.Forms.Padding(4, 5, 4, 5)
$contextMenu.Font = New-Object System.Drawing.Font("Segoe UI", 9.25)

$script:lastOpenTime = 0

function Open-CogitoBrowser {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($now - $script:lastOpenTime -lt 1500) {
        return
    }
    $script:lastOpenTime = $now
    Start-Process $url
}

# 1. Top item: App Icon + Cogito
$appItem = New-Object System.Windows.Forms.ToolStripMenuItem("Cogito")
if ($trayBmp) {
    $menuIcon = New-Object System.Drawing.Bitmap($trayBmp, 18, 18)
    $appItem.Image = $menuIcon
}
$appItem.AutoSize = $false
$appItem.Size = New-Object System.Drawing.Size(160, 32)
$appItem.ForeColor = [System.Drawing.Color]::FromArgb(235, 235, 240)
$appItem.add_Click({
    Open-CogitoBrowser
})
$contextMenu.Items.Add($appItem) | Out-Null

$contextMenu.Items.Add("-") | Out-Null

# 2. Restart Server
$restartItem = New-Object System.Windows.Forms.ToolStripMenuItem("Restart Server")
$restartItem.AutoSize = $false
$restartItem.Size = New-Object System.Drawing.Size(160, 32)
$restartItem.ForeColor = [System.Drawing.Color]::FromArgb(235, 235, 240)
$restartItem.add_Click({
    $notify.ShowBalloonTip(2000, "Cogito", "Restarting server...", [System.Windows.Forms.ToolTipIcon]::Info)
    $cogitoBin = Join-Path $ProjectRoot "bin\cogito.js"
    Start-Process "node" -ArgumentList "`"$cogitoBin`" restart" -WindowStyle Hidden
})
$contextMenu.Items.Add($restartItem) | Out-Null

$contextMenu.Items.Add("-") | Out-Null

# 3. Exit
$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem("Exit")
$exitItem.AutoSize = $false
$exitItem.Size = New-Object System.Drawing.Size(160, 32)
$exitItem.ForeColor = [System.Drawing.Color]::FromArgb(235, 235, 240)
$exitItem.add_Click({
    $notify.Visible = $false
    
    if ($ServerPid -gt 0) {
        try {
            Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    
    $cogitoBin = Join-Path $ProjectRoot "bin\cogito.js"
    Start-Process "node" -ArgumentList "`"$cogitoBin`" stop" -WindowStyle Hidden
    
    $hiddenForm.Close()
    [System.Windows.Forms.Application]::Exit()
})

$notify.ContextMenuStrip = $contextMenu

# Left click opens Web UI
$notify.add_MouseClick({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        Open-CogitoBrowser
    }
})

# Show startup balloon notification
$notify.BalloonTipTitle = "Cogito is Running"
$notify.BalloonTipText = "Cogito Web UI is active at $url`nClick or right-click this icon anytime."
$notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notify.ShowBalloonTip(2500)

# Run message loop anchored to the hidden form (guarantees continuous lifetime)
[System.Windows.Forms.Application]::Run($hiddenForm)
