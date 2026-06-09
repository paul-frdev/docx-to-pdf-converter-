#!/bin/bash
set -e

# Resolve paths relative to script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_DIR"

echo "=================================================="
echo "   macOS Embedded LibreOffice DMG Packager        "
echo "=================================================="

# 1. Compile the application using Wails
echo "Compiling macOS Application with Wails..."
~/go/bin/wails build -platform darwin -ldflags "-s -w"

# Rename the app bundle if it is named docx-to-pdf-desktop.app to DocxToPdfConverter.app
APP_BUNDLE="build/bin/DocxToPdfConverter.app"
if [ -d "build/bin/docx-to-pdf-desktop.app" ]; then
    echo "Normalizing App Bundle name to DocxToPdfConverter.app..."
    rm -rf "$APP_BUNDLE"
    mv "build/bin/docx-to-pdf-desktop.app" "$APP_BUNDLE"
fi

# Ensure that build/bin/DocxToPdfConverter.app exists before moving forward
if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ Error: App bundle not found at $APP_BUNDLE"
    exit 1
fi

# 2. Create the internal resources target directory
echo "Creating internal resources target directory..."
mkdir -p "$APP_BUNDLE/Contents/Resources/libreoffice"

# 3. Ensure build/bin/libreoffice exists and is populated
# If it doesn't contain macOS files, copy them from /Applications/LibreOffice.app
if [ ! -f "build/bin/libreoffice/soffice" ] && [ ! -f "build/bin/libreoffice/MacOS/soffice" ]; then
    echo "Populating local engine folder build/bin/libreoffice from system /Applications/LibreOffice.app..."
    mkdir -p build/bin/libreoffice
    cp -R /Applications/LibreOffice.app/Contents/ build/bin/libreoffice/
    
    # Create soffice delegation wrapper script
    cat << 'EOF' > build/bin/libreoffice/soffice
#!/bin/sh
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
exec "$SCRIPT_DIR/MacOS/soffice" "$@"
EOF
    chmod +x build/bin/libreoffice/soffice
fi

# 4. Safely copy the entire local engine folder into the bundle
echo "Embedding LibreOffice into $APP_BUNDLE/Contents/Resources/libreoffice/..."
cp -R build/bin/libreoffice/ "$APP_BUNDLE/Contents/Resources/libreoffice/"

# 5. Compile the raw bundle into a heavy, self-contained disk image using native macOS tools
echo "Creating redistributable DMG disk image..."
DMG_PATH="build/bin/DocxToPdfConverter.dmg"
rm -f "$DMG_PATH"
hdiutil create -volname "DocxToPdfConverter" -srcfolder "$APP_BUNDLE" -ov -format UDZO "$DMG_PATH"

# 6. Clean up loose external copy to ensure only .dmg and .app remain
echo "Cleaning up loose external directories..."
rm -rf build/bin/libreoffice

echo "=================================================="
echo "✓ Packaging completed successfully!"
echo "Generated DMG: $DMG_PATH"
# Print DMG size
du -h "$DMG_PATH"
echo "=================================================="
