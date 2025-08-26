#!/usr/bin/env python3
"""
Display Environment Fix for GUI Automation
Resolves X11 display issues for PyAutoGUI and GUI automation
"""

import os
import sys
import subprocess
from pathlib import Path

def fix_display_environment():
    """Fix X11 display environment issues"""
    print("🖥️ Fixing Display Environment Issues...")
    
    # Check if running in a display environment
    display = os.environ.get('DISPLAY')
    if not display:
        print("⚠️ No DISPLAY environment variable found")
        # Try to set a default display
        os.environ['DISPLAY'] = ':0.0'
        print("✅ Set DISPLAY=:0.0")
    else:
        print(f"✅ DISPLAY environment: {display}")
    
    # Check for .Xauthority file
    home_dir = Path.home()
    xauth_file = home_dir / '.Xauthority'
    
    if not xauth_file.exists():
        print("⚠️ .Xauthority file missing")
        try:
            # Create empty .Xauthority file
            xauth_file.touch(mode=0o600)
            print("✅ Created .Xauthority file")
        except Exception as e:
            print(f"❌ Failed to create .Xauthority: {e}")
    else:
        print("✅ .Xauthority file exists")
    
    # Set XAUTHORITY environment variable
    os.environ['XAUTHORITY'] = str(xauth_file)
    print(f"✅ Set XAUTHORITY={xauth_file}")
    
    # Check if we're in a headless environment
    try:
        import tkinter
        tkinter.Tk().withdraw()  # Test GUI capability
        print("✅ GUI environment available")
        gui_available = True
    except Exception as e:
        print(f"⚠️ GUI environment not available: {e}")
        gui_available = False
    
    return gui_available

def configure_pyautogui():
    """Configure PyAutoGUI for current environment"""
    print("\n🤖 Configuring PyAutoGUI...")
    
    try:
        import pyautogui
        
        # Disable fail-safe if in automated environment
        pyautogui.FAILSAFE = False
        print("✅ PyAutoGUI fail-safe disabled")
        
        # Set pause between actions
        pyautogui.PAUSE = 0.1
        print("✅ PyAutoGUI pause set to 0.1 seconds")
        
        # Try to get screen size
        try:
            size = pyautogui.size()
            print(f"✅ Screen size detected: {size}")
            return True
        except Exception as e:
            print(f"⚠️ Screen detection failed: {e}")
            print("   GUI automation may not work properly")
            return False
            
    except ImportError:
        print("❌ PyAutoGUI not installed")
        return False

def setup_virtual_display():
    """Setup virtual display for headless environments"""
    print("\n🖼️ Setting up Virtual Display...")
    
    try:
        # Check if xvfb is available
        result = subprocess.run(['which', 'xvfb-run'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Xvfb available for virtual display")
            
            # Set environment for virtual display
            os.environ['DISPLAY'] = ':99'
            print("✅ Virtual display configured on :99")
            
            return True
        else:
            print("⚠️ Xvfb not available")
            print("   Install with: sudo apt-get install xvfb")
            return False
            
    except Exception as e:
        print(f"❌ Virtual display setup failed: {e}")
        return False

def main():
    """Main fix function"""
    print("🔧 DISPLAY ENVIRONMENT FIX")
    print("=" * 40)
    
    # Fix basic display environment
    gui_available = fix_display_environment()
    
    # Configure PyAutoGUI
    pyautogui_ok = configure_pyautogui()
    
    # If no GUI available, try virtual display
    if not gui_available:
        virtual_display_ok = setup_virtual_display()
        if virtual_display_ok:
            gui_available = True
    
    print("\n📊 Environment Status:")
    print(f"GUI Available: {'✅ Yes' if gui_available else '❌ No'}")
    print(f"PyAutoGUI OK: {'✅ Yes' if pyautogui_ok else '❌ No'}")
    
    if gui_available and pyautogui_ok:
        print("\n🎉 Display environment fixed! GUI automation should work now.")
    elif not gui_available:
        print("\n⚠️ Running in headless environment. Browser automation with Playwright recommended.")
    else:
        print("\n❌ Issues remain. Check PyAutoGUI installation.")
    
    return gui_available and pyautogui_ok

if __name__ == "__main__":
    main()