# Native Windows Integration

This directory contains the native Windows desktop system tray integration for Cogito.

## Files

- `tray.cs`: C# Windows Forms application that renders a taskbar notification area (system tray) icon with context menu (Open Cogito Web UI, Restart Server, Exit).
- `tray.exe`: Precompiled standalone executable generated from `tray.cs` using the .NET framework compiler.
- `tray.ps1`: Pure PowerShell fallback system tray runner that doesn't require compiling `tray.cs`.
- `make-tray-icon.ps1`: Helper script that generates the terracotta `#C9603F` tray icon bitmap.
- `tray.log`: Local runtime and event log for the tray icon process.
