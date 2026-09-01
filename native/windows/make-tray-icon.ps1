Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\..\src\app\icon.png"
$dstPath = Join-Path $PSScriptRoot "..\..\src\app\tray-icon.png"

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$newBmp = New-Object System.Drawing.Bitmap($srcBmp.Width, $srcBmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $srcBmp.Height; $y++) {
    for ($x = 0; $x -lt $srcBmp.Width; $x++) {
        $pixel = $srcBmp.GetPixel($x, $y)
        if ($pixel.A -gt 15) {
            # Recolor to vibrant Cogito terracotta (#C9603F, RGB: 201, 96, 63)
            # This makes the icon stand out clearly on dark taskbars and light taskbars alike
            $color = [System.Drawing.Color]::FromArgb($pixel.A, 201, 96, 63)
            $newBmp.SetPixel($x, $y, $color)
        }
    }
}

$newBmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
$srcBmp.Dispose()
$newBmp.Dispose()
Write-Host "Created $dstPath"
