#!/usr/bin/env python3
"""
Comprehensive Automation Manager for Cartrita V2
Integrates Selenium, Playwright, PyAutoGUI and other automation tools
Provides unified interface for web automation, GUI automation, and browser control
"""

import os
import sys
import time
import logging
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass, field
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import automation libraries with fallbacks
automation_backends = {}

# Selenium
try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.common.exceptions import WebDriverException, TimeoutException
    from webdriver_manager.chrome import ChromeDriverManager
    from webdriver_manager.firefox import GeckoDriverManager
    from webdriver_manager.core.os_manager import ChromeType
    automation_backends['selenium'] = True
    logger.info("✅ Selenium backend available")
except ImportError as e:
    automation_backends['selenium'] = False
    logger.warning(f"⚠️ Selenium import failed: {e}")

# Playwright
try:
    from playwright.sync_api import sync_playwright
    from playwright.async_api import async_playwright
    automation_backends['playwright'] = True
    logger.info("✅ Playwright backend available")
except ImportError as e:
    automation_backends['playwright'] = False
    logger.warning(f"⚠️ Playwright import failed: {e}")

# PyAutoGUI with enhanced configuration
try:
    # Set optimal environment for X11 compatibility
    os.environ.setdefault('DISPLAY', ':99')  # Use virtual display
    import pyautogui
    # Configure PyAutoGUI for automation
    pyautogui.FAILSAFE = False  # Disable failsafe for automation
    pyautogui.PAUSE = 0.1  # Minimal pause between actions
    automation_backends['pyautogui'] = True
    logger.info("✅ PyAutoGUI backend available with enhanced configuration")
except Exception as e:
    automation_backends['pyautogui'] = False
    logger.warning(f"⚠️ PyAutoGUI configuration failed: {e}")

# Virtual Display with auto-setup
try:
    from pyvirtualdisplay import Display
    automation_backends['display'] = True
    logger.info("✅ Virtual Display available with auto-setup")
except ImportError as e:
    automation_backends['display'] = False
    # Try alternative virtual display setup
    try:
        import subprocess
        subprocess.run(['which', 'Xvfb'], check=True, capture_output=True)
        automation_backends['display'] = True
        logger.info("✅ Xvfb virtual display available")
    except:
        logger.warning(f"⚠️ No virtual display options available: {e}")

class AutomationType(Enum):
    """Types of automation available"""
    WEB_SELENIUM = "selenium"
    WEB_PLAYWRIGHT = "playwright"
    GUI_PYAUTOGUI = "pyautogui"
    HYBRID = "hybrid"

@dataclass
class AutomationConfig:
    """Enterprise-grade configuration for automation sessions"""
    automation_type: AutomationType = AutomationType.WEB_PLAYWRIGHT  # Default to working backend
    headless: bool = True
    browser: str = "chromium"  # Use Playwright's chromium
    timeout: int = 30
    window_size: tuple = (1920, 1080)
    virtual_display: bool = True
    screenshot_on_error: bool = True
    user_agent: str = "Mozilla/5.0 (Linux; x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    additional_options: List[str] = field(default_factory=list)
    # Enterprise features
    performance_monitoring: bool = True
    error_recovery: bool = True
    auto_retry: bool = True
    max_retries: int = 3
    logging_level: str = "INFO"
    session_recording: bool = False
    load_balancing: bool = False

class AutomationManager:
    """Unified automation manager supporting multiple backends"""
    
    def __init__(self, config: AutomationConfig = None):
        self.config = config or AutomationConfig()
        self.drivers = {}
        self.virtual_display = None
        self.active_backend = None
        self.session_data = {}
        
    def initialize(self) -> bool:
        """Initialize automation environment"""
        try:
            # Set up virtual display if needed
            if self.config.virtual_display and automation_backends['display']:
                self._setup_virtual_display()
            
            # Initialize primary backend
            success = self._initialize_backend()
            
            if success:
                logger.info(f"✅ Automation manager initialized with {self.active_backend}")
                return True
            else:
                logger.error("❌ Failed to initialize any automation backend")
                return False
                
        except Exception as e:
            logger.error(f"❌ Automation initialization error: {e}")
            return False
    
    def _setup_virtual_display(self):
        """Set up virtual display for headless automation"""
        try:
            self.virtual_display = Display(visible=0, size=self.config.window_size)
            self.virtual_display.start()
            logger.info("✅ Virtual display started")
        except Exception as e:
            logger.warning(f"⚠️ Virtual display setup failed: {e}")
    
    def _initialize_backend(self) -> bool:
        """Initialize the best available automation backend"""
        backends_to_try = [
            AutomationType.WEB_PLAYWRIGHT,
            AutomationType.WEB_SELENIUM,
            AutomationType.GUI_PYAUTOGUI
        ]
        
        if self.config.automation_type in backends_to_try:
            backends_to_try.insert(0, self.config.automation_type)
        
        for backend in backends_to_try:
            try:
                if self._init_backend(backend):
                    self.active_backend = backend
                    return True
            except Exception as e:
                logger.warning(f"⚠️ Backend {backend} initialization failed: {e}")
        
        return False
    
    def _init_backend(self, backend: AutomationType) -> bool:
        """Initialize specific backend"""
        if backend == AutomationType.WEB_SELENIUM:
            return self._init_selenium()
        elif backend == AutomationType.WEB_PLAYWRIGHT:
            return self._init_playwright()
        elif backend == AutomationType.GUI_PYAUTOGUI:
            return self._init_pyautogui()
        return False
    
    def _init_selenium(self) -> bool:
        """Initialize Selenium WebDriver"""
        if not automation_backends['selenium']:
            return False
            
        try:
            # Try different browsers
            browsers = ['chrome', 'firefox']
            if self.config.browser in browsers:
                browsers.insert(0, self.config.browser)
            
            for browser in browsers:
                try:
                    driver = self._create_selenium_driver(browser)
                    if driver:
                        self.drivers['selenium'] = driver
                        logger.info(f"✅ Selenium WebDriver created with {browser}")
                        return True
                except Exception as e:
                    logger.warning(f"⚠️ Selenium {browser} failed: {e}")
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Selenium initialization error: {e}")
            return False
    
    def _create_selenium_driver(self, browser: str):
        """Create Selenium WebDriver for specific browser"""
        if browser == 'chrome':
            options = ChromeOptions()
            if self.config.headless:
                options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument(f'--window-size={self.config.window_size[0]},{self.config.window_size[1]}')
            options.add_argument(f'--user-agent={self.config.user_agent}')
            
            for opt in self.config.additional_options:
                options.add_argument(opt)
            
            try:
                # Try Chromium first
                service = webdriver.ChromeService(
                    ChromeDriverManager(chrome_type=ChromeType.CHROMIUM).install()
                )
                return webdriver.Chrome(service=service, options=options)
            except:
                # Fallback to Chrome
                service = webdriver.ChromeService(
                    ChromeDriverManager().install()
                )
                return webdriver.Chrome(service=service, options=options)
                
        elif browser == 'firefox':
            options = FirefoxOptions()
            if self.config.headless:
                options.add_argument('--headless')
            
            service = webdriver.FirefoxService(
                GeckoDriverManager().install()
            )
            return webdriver.Firefox(service=service, options=options)
        
        return None
    
    def _init_playwright(self) -> bool:
        """Initialize Playwright browser"""
        if not automation_backends['playwright']:
            return False
            
        try:
            self.drivers['playwright'] = sync_playwright().start()
            # Use chromium instead of chrome for Playwright
            browser_name = 'chromium' if self.config.browser == 'chrome' else self.config.browser
            browser = getattr(self.drivers['playwright'], browser_name)
            
            self.drivers['playwright_browser'] = browser.launch(
                headless=self.config.headless
            )
            
            self.drivers['playwright_page'] = self.drivers['playwright_browser'].new_page(
                viewport={'width': self.config.window_size[0], 'height': self.config.window_size[1]},
                user_agent=self.config.user_agent
            )
            
            logger.info("✅ Playwright browser initialized")
            return True
            
        except Exception as e:
            logger.error(f"❌ Playwright initialization error: {e}")
            return False
    
    def _init_pyautogui(self) -> bool:
        """Initialize PyAutoGUI"""
        if not automation_backends['pyautogui']:
            return False
            
        try:
            pyautogui.FAILSAFE = True
            pyautogui.PAUSE = 0.5
            self.drivers['pyautogui'] = pyautogui
            logger.info("✅ PyAutoGUI initialized")
            return True
            
        except Exception as e:
            logger.error(f"❌ PyAutoGUI initialization error: {e}")
            return False
    
    # Web automation methods
    def navigate_to(self, url: str) -> bool:
        """Navigate to a URL using active web backend"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                self.drivers['selenium'].get(url)
                WebDriverWait(self.drivers['selenium'], self.config.timeout).until(
                    lambda d: d.execute_script("return document.readyState") == "complete"
                )
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                self.drivers['playwright_page'].goto(url)
            
            logger.info(f"✅ Navigated to: {url}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Navigation failed for {url}: {e}")
            if self.config.screenshot_on_error:
                self.take_screenshot(f"nav_error_{int(time.time())}")
            return False
    
    def find_element(self, selector: str, by_type: str = "css") -> Any:
        """Find element using active backend"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                if by_type == "css":
                    return self.drivers['selenium'].find_element(By.CSS_SELECTOR, selector)
                elif by_type == "xpath":
                    return self.drivers['selenium'].find_element(By.XPATH, selector)
                elif by_type == "id":
                    return self.drivers['selenium'].find_element(By.ID, selector)
                elif by_type == "class":
                    return self.drivers['selenium'].find_element(By.CLASS_NAME, selector)
            
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                return self.drivers['playwright_page'].query_selector(selector)
            
        except Exception as e:
            logger.error(f"❌ Element not found {selector}: {e}")
            return None
    
    def click_element(self, selector: str, by_type: str = "css") -> bool:
        """Click element using active backend"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                element = self.find_element(selector, by_type)
                if element:
                    element.click()
                    return True
            
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                self.drivers['playwright_page'].click(selector)
                return True
            
        except Exception as e:
            logger.error(f"❌ Click failed for {selector}: {e}")
            return False
        
        return False
    
    def type_text(self, selector: str, text: str, by_type: str = "css") -> bool:
        """Type text into element"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                element = self.find_element(selector, by_type)
                if element:
                    element.clear()
                    element.send_keys(text)
                    return True
            
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                self.drivers['playwright_page'].fill(selector, text)
                return True
            
        except Exception as e:
            logger.error(f"❌ Type text failed for {selector}: {e}")
            return False
        
        return False
    
    def get_text(self, selector: str, by_type: str = "css") -> str:
        """Get text from element"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                element = self.find_element(selector, by_type)
                return element.text if element else ""
            
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                return self.drivers['playwright_page'].text_content(selector) or ""
            
        except Exception as e:
            logger.error(f"❌ Get text failed for {selector}: {e}")
            return ""
    
    def wait_for_element(self, selector: str, timeout: int = None) -> bool:
        """Wait for element to appear"""
        timeout = timeout or self.config.timeout
        
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                WebDriverWait(self.drivers['selenium'], timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                return True
            
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                self.drivers['playwright_page'].wait_for_selector(selector, timeout=timeout*1000)
                return True
            
        except Exception as e:
            logger.error(f"❌ Wait failed for {selector}: {e}")
            return False
        
        return False
    
    def execute_javascript(self, script: str) -> Any:
        """Execute JavaScript in browser"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                return self.drivers['selenium'].execute_script(script)
            
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                return self.drivers['playwright_page'].evaluate(script)
            
        except Exception as e:
            logger.error(f"❌ JavaScript execution failed: {e}")
            return None
    
    # GUI automation methods
    def gui_click(self, x: int, y: int) -> bool:
        """Click at GUI coordinates"""
        if not automation_backends['pyautogui']:
            return False
            
        try:
            pyautogui.click(x, y)
            logger.info(f"✅ GUI clicked at ({x}, {y})")
            return True
        except Exception as e:
            logger.error(f"❌ GUI click failed: {e}")
            return False
    
    def gui_type(self, text: str) -> bool:
        """Type text using GUI automation"""
        if not automation_backends['pyautogui']:
            return False
            
        try:
            pyautogui.typewrite(text)
            logger.info(f"✅ GUI typed: {text[:50]}...")
            return True
        except Exception as e:
            logger.error(f"❌ GUI type failed: {e}")
            return False
    
    def gui_screenshot(self, filename: str = None) -> str:
        """Take GUI screenshot"""
        if not automation_backends['pyautogui']:
            return ""
            
        try:
            if not filename:
                filename = f"gui_screenshot_{int(time.time())}.png"
            
            screenshot = pyautogui.screenshot()
            screenshot.save(filename)
            logger.info(f"✅ GUI screenshot saved: {filename}")
            return filename
        except Exception as e:
            logger.error(f"❌ GUI screenshot failed: {e}")
            return ""
    
    # Universal methods
    def take_screenshot(self, filename: str = None) -> str:
        """Take screenshot using active backend"""
        try:
            if not filename:
                filename = f"screenshot_{int(time.time())}.png"
            
            if self.active_backend == AutomationType.WEB_SELENIUM:
                self.drivers['selenium'].save_screenshot(filename)
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                self.drivers['playwright_page'].screenshot(path=filename)
            elif automation_backends['pyautogui']:
                return self.gui_screenshot(filename)
            
            logger.info(f"✅ Screenshot saved: {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"❌ Screenshot failed: {e}")
            return ""
    
    def get_page_title(self) -> str:
        """Get current page title"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                return self.drivers['selenium'].title
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                return self.drivers['playwright_page'].title()
        except Exception as e:
            logger.error(f"❌ Get title failed: {e}")
        return ""
    
    def get_current_url(self) -> str:
        """Get current URL"""
        try:
            if self.active_backend == AutomationType.WEB_SELENIUM:
                return self.drivers['selenium'].current_url
            elif self.active_backend == AutomationType.WEB_PLAYWRIGHT:
                return self.drivers['playwright_page'].url
        except Exception as e:
            logger.error(f"❌ Get URL failed: {e}")
        return ""
    
    def cleanup(self):
        """Clean up all automation resources"""
        try:
            # Clean up Selenium
            if 'selenium' in self.drivers:
                self.drivers['selenium'].quit()
                logger.info("✅ Selenium driver cleaned up")
            
            # Clean up Playwright
            if 'playwright_browser' in self.drivers:
                self.drivers['playwright_browser'].close()
            if 'playwright' in self.drivers:
                self.drivers['playwright'].stop()
                logger.info("✅ Playwright cleaned up")
            
            # Clean up virtual display
            if self.virtual_display:
                self.virtual_display.stop()
                logger.info("✅ Virtual display stopped")
            
        except Exception as e:
            logger.error(f"❌ Cleanup error: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get automation manager status"""
        return {
            'active_backend': str(self.active_backend) if self.active_backend else None,
            'available_backends': [k for k, v in automation_backends.items() if v],
            'drivers_active': list(self.drivers.keys()),
            'config': {
                'headless': self.config.headless,
                'browser': self.config.browser,
                'timeout': self.config.timeout,
                'virtual_display': self.config.virtual_display
            }
        }
    
    # Context manager support
    def __enter__(self):
        self.initialize()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()

# Convenience functions
def create_automation_session(config: AutomationConfig = None):
    """Create an automation session"""
    return AutomationManager(config)

def test_automation_setup():
    """Test all available automation backends"""
    print("🧪 Testing Automation Manager Setup...")
    
    print(f"\n📊 Available backends:")
    for backend, available in automation_backends.items():
        status = "✅ Available" if available else "❌ Not available"
        print(f"  {backend}: {status}")
    
    # Test web automation
    config = AutomationConfig(headless=True, timeout=10)
    
    with create_automation_session(config) as session:
        status = session.get_status()
        print(f"\n📋 Session Status:")
        print(f"  Active Backend: {status['active_backend']}")
        print(f"  Available Backends: {status['available_backends']}")
        print(f"  Active Drivers: {status['drivers_active']}")
        
        if session.active_backend:
            print(f"\n🎉 Automation Manager successfully initialized!")
            
            # Test basic functionality if web backend is active
            if session.active_backend in [AutomationType.WEB_SELENIUM, AutomationType.WEB_PLAYWRIGHT]:
                print("🌐 Testing web navigation...")
                if session.navigate_to("https://httpbin.org/get"):
                    title = session.get_page_title()
                    url = session.get_current_url()
                    print(f"✅ Successfully navigated - Title: {title}")
                    print(f"✅ Current URL: {url}")
                    
                    # Take a screenshot
                    screenshot = session.take_screenshot("test_automation.png")
                    if screenshot:
                        print(f"✅ Screenshot saved: {screenshot}")
                else:
                    print("❌ Web navigation test failed")
            
            return True
        else:
            print("❌ No automation backend could be initialized")
            return False

if __name__ == "__main__":
    test_automation_setup()