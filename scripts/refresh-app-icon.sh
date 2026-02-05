#!/bin/bash
# Force macOS to drop cached icons for Paradise PDF so the Dock shows the correct icon.
# Run: ./scripts/refresh-app-icon.sh
# You may be prompted for your password (sudo).

set -e
APP="/Applications/Paradise PDF.app"

echo "Refreshing icon cache for Paradise PDF..."

# 1. Quit the app if running (optional; uncomment to force quit)
# osascript -e 'quit app "Paradise PDF"' 2>/dev/null || true

# 2. Remove system icon caches (requires sudo)
sudo rm -rf /Library/Caches/com.apple.iconservices.store 2>/dev/null || true
sudo find /private/var/folders -name "com.apple.dock.iconcache" -exec rm -rf {} \; 2>/dev/null || true
sudo find /private/var/folders -name "com.apple.iconservices" -exec rm -rf {} \; 2>/dev/null || true

# 3. Touch the app so macOS sees it as changed
touch "$APP"

# 4. Restart Dock and Finder so they reload icons
killall Dock
killall Finder

echo "Done. Open Paradise PDF from Applications and check the Dock."
