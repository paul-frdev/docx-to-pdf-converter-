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

echo "Packaging macOS App into a redistributable DMG installer..."
hdiutil create -volname "DocxToPdfConverter" -srcfolder build/bin/docx-to-pdf-desktop.app -ov -format UDZO build/bin/DocxToPdfConverter.dmg

echo ""

# 3. Package Windows Production Bundle
echo "Building Windows AMD64 Production Bundle (Executable/NSIS preparation)..."
~/go/bin/wails build -platform windows/amd64 -ldflags "-s -w"

echo ""
echo "=================================================="
echo "✓ Multi-Platform production builds completed!"
echo "Artifacts saved to: $PROJECT_DIR/build/bin/"
echo "=================================================="
