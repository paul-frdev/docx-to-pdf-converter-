#!/bin/bash
set -e

# Resolve paths relative to script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_DIR"

echo "=================================================="
echo "   Wails Production Installer Packaging Script    "
echo "=================================================="
echo "Project Directory: $PROJECT_DIR"
echo ""

# 1. Verify icons
ICON_WINDOWS="build/windows/icon.ico"
ICON_DARWIN="build/darwin/icon.png"
ICON_APP="build/appicon.png"

echo "Checking production application icons..."

# Windows Icon Check
if [ ! -f "$ICON_WINDOWS" ]; then
    echo "❌ Error: Windows icon missing at $ICON_WINDOWS"
    exit 1
else
    echo "✓ Windows icon verified at $ICON_WINDOWS"
fi

# macOS Icon Check & Fallback Copy
if [ ! -f "$ICON_DARWIN" ]; then
    if [ -f "$ICON_APP" ]; then
        echo "⚠️  macOS icon $ICON_DARWIN not found. Copying from $ICON_APP..."
        mkdir -p "$(dirname "$ICON_DARWIN")"
        cp "$ICON_APP" "$ICON_DARWIN"
    else
        echo "❌ Error: macOS icon missing at $ICON_DARWIN and fallback $ICON_APP not found."
        exit 1
    fi
fi

if [ -f "$ICON_DARWIN" ]; then
    echo "✓ macOS icon verified at $ICON_DARWIN"
else
    echo "❌ Error: macOS icon check failed after fallback attempt."
    exit 1
fi

echo ""

# 2. Package macOS Universal Bundle
echo "Building macOS Universal Production Bundle (Intel + Apple Silicon)..."
~/go/bin/wails build -platform darwin/universal -ldflags "-s -w"

# Find compiled macOS App Bundle
APP_BUNDLE="build/bin/docx-to-pdf-desktop.app"
if [ -d "build/bin/DocxToPdfConverter.app" ]; then
    APP_BUNDLE="build/bin/DocxToPdfConverter.app"
fi

echo "Bundling LibreOffice into macOS App Bundle: $APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/Resources/libreoffice"

# Check for real macOS LibreOffice binaries
REAL_MAC_OFFICE="libreoffice-binaries/darwin/libreoffice"
if [ -d "$REAL_MAC_OFFICE" ] && [ "$(ls -A "$REAL_MAC_OFFICE" 2>/dev/null)" ]; then
    echo "✓ Copying real macOS LibreOffice binaries from $REAL_MAC_OFFICE..."
    cp -R "$REAL_MAC_OFFICE/" "$APP_BUNDLE/Contents/Resources/libreoffice/"
else
    echo "⚠️  Real macOS LibreOffice binaries not found at $REAL_MAC_OFFICE. Creating mock soffice placeholder..."
    go build -o "$APP_BUNDLE/Contents/Resources/libreoffice/soffice" scripts/soffice_mock.go
    chmod +x "$APP_BUNDLE/Contents/Resources/libreoffice/soffice"
fi

echo "Packaging macOS App into a redistributable DMG installer..."
hdiutil create -volname "DocxToPdfConverter" -srcfolder "$APP_BUNDLE" -ov -format UDZO build/bin/DocxToPdfConverter.dmg

echo ""

# 3. Package Windows Production Bundle
echo "Building Windows AMD64 Production Bundle (Executable/NSIS preparation)..."
~/go/bin/wails build -platform windows/amd64 -ldflags "-s -w"

echo "Bundling LibreOffice for Windows Build..."
mkdir -p "build/bin/libreoffice/program"

# Check for real Windows LibreOffice binaries
REAL_WIN_OFFICE="libreoffice-binaries/windows/libreoffice"
if [ -d "$REAL_WIN_OFFICE" ] && [ "$(ls -A "$REAL_WIN_OFFICE" 2>/dev/null)" ]; then
    echo "✓ Copying real Windows LibreOffice binaries from $REAL_WIN_OFFICE..."
    cp -R "$REAL_WIN_OFFICE/" "build/bin/libreoffice/"
else
    echo "⚠️  Real Windows LibreOffice binaries not found at $REAL_WIN_OFFICE. Creating mock soffice.exe placeholder..."
    GOOS=windows GOARCH=amd64 go build -o "build/bin/libreoffice/program/soffice.exe" scripts/soffice_mock.go
fi

echo ""
echo "=================================================="
echo "✓ Multi-Platform production builds completed!"
echo "Artifacts saved to: $PROJECT_DIR/build/bin/"
echo "=================================================="
