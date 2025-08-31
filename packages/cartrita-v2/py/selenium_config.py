#!/usr/bin/env python3
"""
Selenium Configuration Module for Cartrita V2
Provides centralized Selenium WebDriver setup with automatic driver management
"""

import os
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, TimeoutException
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.firefox import GeckoDriverManager
from webdriver_manager.core.os_manager import ChromeType

logger = logging.getLogger(__name__)

class SeleniumManager:
    """Centralized Selenium WebDriver manager for Cartrita V2"""
    
    def __init__(self, headless=True, browser='chrome'):
        self.headless = headless
        self.browser = browser.lower()
        self.driver = None
        self.wait = None
        
    def get_chrome_options(self):
        """Configure Chrome options for optimal automation"""
        options = ChromeOptions()
        
        if self.headless:
            options.add_argument('--headless=new')  # New headless mode
        
        # Security and performance options
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-web-security')
        options.add_argument('--disable-features=VizDisplayCompositor')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-plugins')
        options.add_argument('--disable-images')
        options.add_argument('--disable-javascript')  # Can be removed if JS needed
        
        # Window size for consistent rendering
        options.add_argument('--window-size=1920,1080')
        
        # User agent to avoid bot detection
        options.add_argument('--user-agent=Mozilla/5.0 (Linux; x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        return options
        
    def get_firefox_options(self):
        """Configure Firefox options for automation"""
        options = FirefoxOptions()
        
        if self.headless:
            options.add_argument('--headless')
            
        # Performance options
        options.set_preference('dom.webnotifications.enabled', False)
        options.set_preference('media.volume_scale', '0.0')
        
        return options
    
    def create_driver(self):
        """Create and configure WebDriver instance"""
        try:
            if self.browser == 'chrome':
                return self._create_chrome_driver()
            elif self.browser == 'firefox':
                return self._create_firefox_driver()
            else:
                raise ValueError(f"Unsupported browser: {self.browser}")
                
        except Exception as e:
            logger.error(f"Failed to create WebDriver: {e}")
            raise
    
    def _create_chrome_driver(self):
        """Create Chrome WebDriver with automatic driver management"""
        options = self.get_chrome_options()
        
        try:
            # Try Chromium first (common in Linux environments)
            service = webdriver.ChromeService(
                ChromeDriverManager(chrome_type=ChromeType.CHROMIUM).install()
            )
            driver = webdriver.Chrome(service=service, options=options)
            logger.info("✅ Created Chrome WebDriver with Chromium")
            return driver
            
        except Exception as chromium_error:
            logger.warning(f"Chromium failed: {chromium_error}")
            
            try:
                # Fallback to regular Chrome
                service = webdriver.ChromeService(
                    ChromeDriverManager().install()
                )
                driver = webdriver.Chrome(service=service, options=options)
                logger.info("✅ Created Chrome WebDriver with Chrome")
                return driver
                
            except Exception as chrome_error:
                logger.error(f"Chrome also failed: {chrome_error}")
                raise WebDriverException(f"Could not create Chrome driver: {chrome_error}")
    
    def _create_firefox_driver(self):
        """Create Firefox WebDriver with automatic driver management"""
        options = self.get_firefox_options()
        
        try:
            service = webdriver.FirefoxService(
                GeckoDriverManager().install()
            )
            driver = webdriver.Firefox(service=service, options=options)
            logger.info("✅ Created Firefox WebDriver")
            return driver
            
        except Exception as e:
            logger.error(f"Firefox driver creation failed: {e}")
            raise WebDriverException(f"Could not create Firefox driver: {e}")
    
    def initialize(self, timeout=10):
        """Initialize WebDriver with wait configuration"""
        try:
            self.driver = self.create_driver()
            self.wait = WebDriverWait(self.driver, timeout)
            
            # Set implicit wait
            self.driver.implicitly_wait(timeout)
            
            logger.info(f"✅ Selenium WebDriver initialized successfully ({self.browser})")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Selenium: {e}")
            return False
    
    def get_page(self, url, timeout=30):
        """Navigate to a page with error handling"""
        try:
            self.driver.get(url)
            
            # Wait for page to load
            self.wait.until(
                lambda driver: driver.execute_script("return document.readyState") == "complete"
            )
            
            logger.info(f"✅ Successfully loaded page: {url}")
            return True
            
        except TimeoutException:
            logger.error(f"❌ Page load timeout: {url}")
            return False
        except Exception as e:
            logger.error(f"❌ Failed to load page {url}: {e}")
            return False
    
    def find_element_safe(self, by, value, timeout=10):
        """Find element with timeout and error handling"""
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
            return element
        except TimeoutException:
            logger.warning(f"Element not found: {by}={value}")
            return None
        except Exception as e:
            logger.error(f"Error finding element {by}={value}: {e}")
            return None
    
    def click_element_safe(self, by, value, timeout=10):
        """Click element with retry and error handling"""
        try:
            element = WebDriverWait(self.driver, timeout).until(
                EC.element_to_be_clickable((by, value))
            )
            element.click()
            logger.info(f"✅ Clicked element: {by}={value}")
            return True
        except TimeoutException:
            logger.warning(f"Element not clickable: {by}={value}")
            return False
        except Exception as e:
            logger.error(f"Error clicking element {by}={value}: {e}")
            return False
    
    def get_text_safe(self, by, value, timeout=10):
        """Get element text with error handling"""
        element = self.find_element_safe(by, value, timeout)
        if element:
            try:
                return element.text
            except Exception as e:
                logger.error(f"Error getting text from element {by}={value}: {e}")
        return ""
    
    def take_screenshot(self, filename=None):
        """Take screenshot of current page"""
        try:
            if not filename:
                filename = f"screenshot_{int(time.time())}.png"
                
            self.driver.save_screenshot(filename)
            logger.info(f"✅ Screenshot saved: {filename}")
            return filename
        except Exception as e:
            logger.error(f"❌ Failed to take screenshot: {e}")
            return None
    
    def execute_script_safe(self, script):
        """Execute JavaScript with error handling"""
        try:
            return self.driver.execute_script(script)
        except Exception as e:
            logger.error(f"JavaScript execution failed: {e}")
            return None
    
    def cleanup(self):
        """Clean up WebDriver resources"""
        try:
            if self.driver:
                self.driver.quit()
                logger.info("✅ WebDriver cleaned up successfully")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
        finally:
            self.driver = None
            self.wait = None
    
    def __enter__(self):
        """Context manager entry"""
        self.initialize()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.cleanup()

# Global instance for easy access
selenium_manager = None

def get_selenium_driver(headless=True, browser='chrome', timeout=10):
    """Get a configured Selenium WebDriver instance"""
    global selenium_manager
    
    try:
        selenium_manager = SeleniumManager(headless=headless, browser=browser)
        if selenium_manager.initialize(timeout=timeout):
            return selenium_manager.driver
        else:
            return None
    except Exception as e:
        logger.error(f"Failed to get Selenium driver: {e}")
        return None

def create_selenium_session(headless=True, browser='chrome'):
    """Create a Selenium session context manager"""
    return SeleniumManager(headless=headless, browser=browser)

# Utility functions for common tasks
def web_scrape_page(url, headless=True, browser='chrome'):
    """Simple utility to scrape a web page"""
    with create_selenium_session(headless=headless, browser=browser) as session:
        if session.get_page(url):
            return {
                'title': session.driver.title,
                'url': session.driver.current_url,
                'page_source': session.driver.page_source
            }
    return None

def test_selenium_installation():
    """Test Selenium installation and WebDriver setup"""
    print("🧪 Testing Selenium Installation...")
    
    browsers_to_test = ['chrome', 'firefox']
    working_browsers = []
    
    for browser in browsers_to_test:
        print(f"\n📊 Testing {browser.upper()} WebDriver...")
        
        try:
            with create_selenium_session(headless=True, browser=browser) as session:
                if session.get_page("https://httpbin.org/get"):
                    title = session.driver.title
                    print(f"✅ {browser.upper()} WebDriver working - Page title: {title}")
                    working_browsers.append(browser)
                else:
                    print(f"❌ {browser.upper()} WebDriver failed to load test page")
                    
        except Exception as e:
            print(f"❌ {browser.upper()} WebDriver failed: {e}")
    
    print(f"\n📋 Test Results:")
    print(f"✅ Working browsers: {working_browsers}")
    print(f"❌ Failed browsers: {[b for b in browsers_to_test if b not in working_browsers]}")
    
    if working_browsers:
        print(f"🎉 Selenium is properly installed with {len(working_browsers)} working browser(s)")
        return True
    else:
        print("❌ No working browsers found. Check your WebDriver setup.")
        return False

if __name__ == "__main__":
    import time
    test_selenium_installation()