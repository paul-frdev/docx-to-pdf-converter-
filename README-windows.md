# Windows Build, Compatibility & Deployment Guide

This document outlines the architecture, setup requirements, and compilation steps to package and build the **DOCX to PDF Converter** desktop application for Microsoft Windows (x64) using Wails v2 and Microsoft Edge WebView2.

---

## 1. Windows Compatibility Architecture

The application has been audited and prepared for native Windows OS execution:

*   **File Path Sanitization**: All file operations use Go's standard library `path/filepath` package. This dynamically cleans and converts forward slashes (`/`) to Windows backslashes (`\`) for standard OS file operations.
*   **LibreOffice Executable Resolution**: The backend dynamically looks up the embedded `soffice.exe` inside the execution directory (`./libreoffice/program/soffice.exe` or `./libreoffice/soffice.exe`) or falls back to system installations (`C:\Program Files\LibreOffice\program\soffice.exe` or `C:\Program Files (x86)\...`).
*   **Isolated User Profile Execution**: Spawns LibreOffice with `-env:UserInstallation=file:///C:/Users/...` mapping the profile cleanly to a temp location. Slashes are formatted correctly for file URL protocol compatibility on Windows.
*   **Robust COM Automation Fallback**: If LibreOffice is completely unavailable, the app falls back to standard Windows **Word COM Automation** by dynamically generating and invoking an inline PowerShell command via `powershell.exe`. 
    *   *Path Safety*: Single quotes (`'`) within paths are automatically escaped to duplicate single quotes (`''`) to prevent PowerShell script/syntax injection.
    *   *Interactive Safety*: PowerShell is invoked with `-NoProfile` and `-NonInteractive` flags to prevent user-profile blocking issues.
*   **Webview2 (Chromium) Compliance**: The frontend styling (Glassmorphism, animations, custom scrollbars, layout positioning) uses standard modern CSS that renders with high fidelity on Microsoft Edge WebView2 (Chromium-based layout engine used by Wails on Windows).

---

## 2. Asset Verification

The necessary assets for the Windows build have been initialized and verified inside `desktop/build/windows/`:

*   **`icon.ico`**: Native multi-resolution icon file embedded into the `.exe` file metadata (visible in Windows Explorer and the taskbar).
*   **`wails.exe.manifest`**: Execution manifest defining UAC permissions, DPI awareness (high-DPI display compatibility), and targeting options.
*   **`info.json`**: Product name, version, and copyright strings embedded in the file resource header.
*   **`installer/`**: Contains `project.nsi` and `wails_tools.nsh` template scripts for automated **NSIS installer packaging** (Nullsoft Scriptable Install System).

---

## 3. How to Build on Microsoft Windows (Native)

Building natively on a Windows 10/11 machine is the recommended way to generate production binaries.

### Prerequisites
1.  **Go SDK**: Install Go (version 1.20 or later) from [golang.org](https://go.dev/dl/). Ensure `go` is on your system `PATH`.
2.  **Node.js & NPM**: Install Node.js (version 16 or later) from [nodejs.org](https://nodejs.org/).
3.  **C/C++ Compiler**: Install a C/C++ compiler. The easiest way is using **MSYS2**:
    *   Download and install [MSYS2](https://www.msys2.org/).
    *   Open the MSYS2 UCRT64 terminal and run: `pacman -S mingw-w64-ucrt-x86_64-gcc`
    *   Add `C:\msys64\ucrt64\bin` to your system environment variables `PATH`.
4.  **Wails CLI**: Install the Wails CLI command:
    ```powershell
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    ```
5.  **NSIS (Optional for Installer Creation)**:
    *   Download and install [NSIS](https://nsis.sourceforge.io/Download).
    *   Ensure the `makensis.exe` directory is added to your system `PATH`.

### Local Compilation Command
Navigate to the `desktop` directory and run:
```powershell
wails build -platform windows/amd64 -clean -nsis
```

*   `-platform windows/amd64`: Targets standard 64-bit Windows.
*   `-clean`: Cleans the frontend and build caches before building.
*   `-nsis`: Packages the built `.exe` along with embedded assets inside a lightweight installer `.exe` using NSIS.
*   *Note*: The production build automatically detaches the console window (no CMD popup on launch) and strips debug symbols.

---

## 4. How to Cross-Compile on macOS for Windows

If you need to cross-compile the Windows executable directly from macOS:

### Prerequisites
1.  **MinGW-w64 Toolchain**: Cross-compilation requires the GNU compiler collection for Windows. Install it via Homebrew:
    ```bash
    brew install mingw-w64
    ```
2.  **CGO Configuration**: Cross-compilation requires enabling CGO and setting the Windows cross-compiler path.

### Cross-Compilation Command
Run this command from the `desktop/` directory:
```bash
CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc wails build -platform windows/amd64 -clean
```

---

## 5. Automated CI/CD Build Pipeline (GitHub Actions)

To automate production releases and ensure consistent binary builds, you can use a GitHub Actions workflow.

Create a file at `.github/workflows/build-windows.yml`:

```yaml
name: Build Windows Production Executable

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
    - name: Checkout Code
      uses: actions/checkout@v4

    - name: Setup Go
      uses: actions/setup-go@v5
      with:
        go-version: '1.21'
        cache: true

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: desktop/frontend/package-lock.json

    - name: Install NSIS
      run: |
        choco install nsis -y
        echo "C:\Program Files (x86)\NSIS" >> $GITHUB_PATH

    - name: Install Wails CLI
      run: go install github.com/wailsapp/wails/v2/cmd/wails@latest

    - name: Build and Package Installer
      working-directory: ./desktop
      run: wails build -platform windows/amd64 -clean -nsis

    - name: Upload Artifacts
      uses: actions/upload-artifact@v4
      with:
        name: docx-to-pdf-windows-installer
        path: |
          desktop/build/bin/desktop.exe
          desktop/build/bin/*-installer.exe
```

---

## 6. Post-Build Assembly & LibreOffice Embedding

To bundle a completely offline installation on Windows (avoiding external LibreOffice requirements):

1.  Verify that your compiled binary `desktop.exe` is created inside `desktop/build/bin/`.
2.  Obtain a portable version of LibreOffice (or copy an existing installation).
3.  Structure the directory layout inside `desktop/build/bin/` as follows:
    ```text
    build/bin/
    ├── desktop.exe (Your main application)
    └── libreoffice/
        ├── soffice.exe
        └── program/
            └── soffice.exe
    ```
4.  When distributed like this, the Go backend will automatically detect the local directory, extract the conversion instructions, and process files offline.
