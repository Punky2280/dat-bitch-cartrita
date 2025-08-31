#!/bin/bash
# Setup headless display for GUI applications

# Set up virtual display
export DISPLAY=:99
export XAUTHORITY=/tmp/.X99-auth

# Start virtual framebuffer if not running
if ! pgrep -x "Xvfb" > /dev/null; then
    echo "Starting Xvfb virtual display..."
    Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset &
    sleep 2
fi

# Create X authority file
xauth -f $XAUTHORITY add $DISPLAY . $(mcookie)

echo "✅ Headless display setup complete"
echo "DISPLAY=$DISPLAY"
echo "XAUTHORITY=$XAUTHORITY"