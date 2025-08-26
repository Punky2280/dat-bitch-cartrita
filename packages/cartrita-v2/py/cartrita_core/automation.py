"""
Cartrita V2 - Automation Backend
Provides real computer use automation capabilities with fallback options
"""

import io
from PIL import Image

# Real computer use automation - prioritize working solutions over mocks
AUTOMATION_MODE = "disabled"
automation_backend = None

# Try PyAutoGUI first (only when a display is available)
import os
if os.getenv("DISPLAY"):
    try:
        import pyautogui
        automation_backend = pyautogui
        AUTOMATION_MODE = "pyautogui"
        print("✅ PyAutoGUI loaded - GUI automation available (DISPLAY detected)")
    except Exception as e:
        print(f"⚠️  PyAutoGUI failed: {e}")
else:
    # Ensure headless-friendly matplotlib backend
    os.environ.setdefault("MPLBACKEND", "Agg")
    print("ℹ️  Headless environment detected (no DISPLAY). Skipping PyAutoGUI.")
    
    # Try Playwright for headless browser automation
    try:
        from playwright.sync_api import sync_playwright
        
        class PlaywrightAutomation:
            def __init__(self):
                self.playwright = None
                self.browser = None
                self.page = None
                self.FAILSAFE = True
                self.PAUSE = 0.5
                
            def _ensure_browser(self):
                if not self.playwright:
                    self.playwright = sync_playwright().start()
                if not self.browser:
                    self.browser = self.playwright.chromium.launch(headless=True)
                if not self.page:
                    self.page = self.browser.new_page()
                    self.page.set_viewport_size({"width": 1024, "height": 768})
            
            def size(self):
                class Size:
                    width = 1024
                    height = 768
                return Size()
            
            def click(self, x, y):
                self._ensure_browser()
                if not self.page:
                    print("⚠️ Error: Page not initialized")
                    return
                # Real browser click at coordinates
                self.page.mouse.click(x, y)
                print(f"🖱️  Browser click at ({x}, {y})")
                
            def typewrite(self, text):
                self._ensure_browser()
                # Real browser text input
                if self.page:
                    self.page.keyboard.type(text)
                    print(f"⌨️  Browser type: {text}")
                else:
                    print("⚠️ Error: Cannot type text - page not initialized")
                
            def scroll(self, clicks):
                self._ensure_browser()
                # Real browser scroll
                if self.page:
                    self.page.mouse.wheel(0, clicks * 100)
                    print(f"🔄 Browser scroll: {clicks}")
                else:
                    print("⚠️ Error: Cannot scroll - page not initialized")
                
            def screenshot(self):
                self._ensure_browser()
                if self.page:
                    screenshot_bytes = self.page.screenshot()
                    return Image.open(io.BytesIO(screenshot_bytes))
                else:
                    print("⚠️ Error: Cannot take screenshot - page not initialized")
                    return None
                
            def __del__(self):
                if self.browser:
                    self.browser.close()
                if self.playwright:
                    self.playwright.stop()
        
        automation_backend = PlaywrightAutomation()
        AUTOMATION_MODE = "playwright"
        print("✅ Playwright loaded - browser automation available")
        
    except Exception as e:
        print(f"⚠️  Playwright failed: {e}")
        
        # Try Selenium as fallback
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.common.action_chains import ActionChains
            
            class SeleniumAutomation:
                def __init__(self):
                    self.driver = None
                    self.FAILSAFE = True
                    self.PAUSE = 0.5
                    
                def _ensure_driver(self):
                    if not self.driver:
                        chrome_options = Options()
                        chrome_options.add_argument('--headless')
                        chrome_options.add_argument('--no-sandbox')
                        chrome_options.add_argument('--disable-dev-shm-usage')
                        chrome_options.add_argument('--window-size=1024,768')
                        
                        self.driver = webdriver.Chrome(options=chrome_options)
                        
                def size(self):
                    class Size:
                        width = 1024
                        height = 768
                    return Size()
                
                def click(self, x, y):
                    self._ensure_driver()
                    # Real Selenium click
                    if self.driver:
                        ActionChains(self.driver).move_by_offset(x, y).click().perform()
                        print(f"🖱️  Selenium click at ({x}, {y})")
                    else:
                        print("⚠️ Error: Driver not initialized")
                    
                def typewrite(self, text):
                    self._ensure_driver()
                    # Real Selenium text input
                    if self.driver:
                        ActionChains(self.driver).send_keys(text).perform()
                        print(f"⌨️  Selenium type: {text}")
                    else:
                        print("⚠️ Error: Driver not initialized")
                    
                def scroll(self, clicks):
                    self._ensure_driver()
                    # Real Selenium scroll
                    if self.driver:
                        self.driver.execute_script(f"window.scrollBy(0, {clicks * 100});")
                        print(f"🔄 Selenium scroll: {clicks}")
                    else:
                        print("⚠️ Error: Driver not initialized")
                    
                def screenshot(self):
                    self._ensure_driver()
                    if self.driver:
                        screenshot_path = '/tmp/selenium_screenshot.png'
                        self.driver.save_screenshot(screenshot_path)
                        return Image.open(screenshot_path)
                    else:
                        print("⚠️ Error: Driver not initialized")
                        return None
                    
                def __del__(self):
                    if self.driver:
                        self.driver.quit()
            
            automation_backend = SeleniumAutomation()
            AUTOMATION_MODE = "selenium"
            print("✅ Selenium loaded - web automation available")
            
        except Exception as e:
            print(f"❌ All automation backends failed: {e}")
            print("❌ Computer use will be disabled")
            AUTOMATION_MODE = "disabled"

# Backward compatibility alias
pyautogui = automation_backend