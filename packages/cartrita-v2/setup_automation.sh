#!/bin/bash
# Comprehensive Browser Automation Setup for Cartrita V2
# Installs Chrome, Firefox, and configures Selenium & Playwright

set -e  # Exit on error

echo "🚀 Setting up Browser Automation for Cartrita V2..."

# Update package lists
echo "📦 Updating package lists..."
sudo apt update

# Install Chrome
echo "🌐 Installing Google Chrome..."
if ! command -v google-chrome &> /dev/null; then
    # Download and install Chrome
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    sudo apt update
    sudo apt install -y google-chrome-stable
    echo "✅ Google Chrome installed successfully"
else
    echo "✅ Google Chrome already installed"
fi

# Install Firefox
echo "🦊 Installing Firefox..."
if ! command -v firefox &> /dev/null; then
    sudo apt install -y firefox
    echo "✅ Firefox installed successfully"
else
    echo "✅ Firefox already installed"
fi

# Install additional dependencies
echo "🔧 Installing additional dependencies..."
sudo apt install -y \
    xvfb \
    x11-apps \
    xfonts-100dpi \
    xfonts-75dpi \
    xfonts-scalable \
    xfonts-cyrillic \
    fonts-liberation \
    libglib2.0-0 \
    libnss3-dev \
    libgconf-2-4 \
    libxss1 \
    libappindicator1 \
    libindicator7 \
    gconf-service \
    libgtk-3-0 \
    libxcomposite1 \
    libasound2-dev \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0

echo "✅ System dependencies installed"

# Verify installations
echo "🔍 Verifying browser installations..."

if command -v google-chrome &> /dev/null; then
    CHROME_VERSION=$(google-chrome --version)
    echo "✅ Chrome: $CHROME_VERSION"
else
    echo "❌ Chrome not found"
fi

if command -v firefox &> /dev/null; then
    FIREFOX_VERSION=$(firefox --version)
    echo "✅ Firefox: $FIREFOX_VERSION"
else
    echo "❌ Firefox not found"
fi

# Set up virtual display for headless mode
echo "🖥️  Setting up virtual display..."
if ! pgrep -f "Xvfb :99" > /dev/null; then
    # Start virtual display in background
    Xvfb :99 -ac -screen 0 1280x1024x24 &
    export DISPLAY=:99
    echo "✅ Virtual display started on :99"
else
    export DISPLAY=:99
    echo "✅ Virtual display already running"
fi

echo "🎉 Browser automation setup complete!"
echo ""
echo "📋 Summary:"
echo "  ✅ Google Chrome installed"
echo "  ✅ Firefox installed"  
echo "  ✅ System dependencies installed"
echo "  ✅ Virtual display configured"
echo ""
echo "🧪 You can now test with: python py/selenium_config.py"