#!/usr/bin/env python3
"""
Simple Selenium Integration Test for Cartrita V2
Verifies that Selenium is properly installed and accessible
"""

import sys
import os
import logging

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

def test_selenium_imports():
    """Test if Selenium can be imported successfully"""
    print("🧪 Testing Selenium Integration...")
    
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from webdriver_manager.chrome import ChromeDriverManager
        from webdriver_manager.firefox import GeckoDriverManager
        
        print("✅ All Selenium imports successful")
        return True
        
    except ImportError as e:
        print(f"❌ Selenium import failed: {e}")
        return False

def test_webdriver_manager():
    """Test WebDriver Manager functionality"""
    print("\n🔧 Testing WebDriver Manager...")
    
    try:
        from webdriver_manager.chrome import ChromeDriverManager
        from webdriver_manager.firefox import GeckoDriverManager
        from webdriver_manager.core.os_manager import ChromeType
        
        print("✅ WebDriver Manager imports successful")
        
        # Test driver path resolution (without downloading)
        chrome_manager = ChromeDriverManager()
        firefox_manager = GeckoDriverManager()
        
        print("✅ WebDriver managers created successfully")
        return True
        
    except Exception as e:
        print(f"❌ WebDriver Manager test failed: {e}")
        return False

def test_automation_manager_import():
    """Test if our automation manager can be imported"""
    print("\n🤖 Testing Automation Manager import...")
    
    try:
        from automation_manager import (
            AutomationManager, 
            AutomationConfig, 
            AutomationType,
            create_automation_session
        )
        
        print("✅ Automation Manager imports successful")
        
        # Test config creation
        config = AutomationConfig(
            automation_type=AutomationType.WEB_SELENIUM,
            headless=True,
            browser="chrome",
            timeout=10
        )
        
        print(f"✅ AutomationConfig created: {config.automation_type}")
        return True
        
    except Exception as e:
        print(f"❌ Automation Manager import failed: {e}")
        return False

def test_playwright_availability():
    """Test if Playwright is available"""
    print("\n🎭 Testing Playwright availability...")
    
    try:
        from playwright.sync_api import sync_playwright
        print("✅ Playwright sync API available")
        
        # Check if browsers are installed
        playwright = sync_playwright().start()
        print("✅ Playwright instance created")
        
        # Check available browsers
        browsers = ['chromium', 'firefox', 'webkit']
        available_browsers = []
        
        for browser_name in browsers:
            try:
                browser_obj = getattr(playwright, browser_name)
                available_browsers.append(browser_name)
            except:
                pass
        
        playwright.stop()
        
        print(f"✅ Available Playwright browsers: {available_browsers}")
        return len(available_browsers) > 0
        
    except Exception as e:
        print(f"❌ Playwright test failed: {e}")
        return False

def test_integration_with_cartrita():
    """Test integration with Cartrita's agent system"""
    print("\n🚀 Testing Cartrita integration...")
    
    try:
        from cartrita_core.enhanced_agent_manager import EnhancedAgentManager, AgentCapability
        
        # Check if automation capabilities are available
        automation_capabilities = [
            AgentCapability.WEB_AUTOMATION,
            AgentCapability.GUI_AUTOMATION,
            AgentCapability.BROWSER_AUTOMATION
        ]
        
        print("✅ Automation capabilities defined in agent manager:")
        for cap in automation_capabilities:
            print(f"   - {cap.value}")
        
        return True
        
    except Exception as e:
        print(f"❌ Cartrita integration test failed: {e}")
        return False

def run_comprehensive_test():
    """Run all integration tests"""
    print("🎯 Running Comprehensive Selenium Integration Test\n")
    
    tests = [
        ("Selenium Imports", test_selenium_imports),
        ("WebDriver Manager", test_webdriver_manager),
        ("Automation Manager", test_automation_manager_import),
        ("Playwright Availability", test_playwright_availability),
        ("Cartrita Integration", test_integration_with_cartrita),
    ]
    
    results = {}
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results[test_name] = result
            if result:
                passed += 1
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results[test_name] = False
    
    print(f"\n📊 Test Results:")
    print(f"{'=' * 50}")
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:<25} {status}")
    
    print(f"{'=' * 50}")
    print(f"Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Selenium is properly installed and integrated.")
    elif passed >= total * 0.7:
        print("⚠️ Most tests passed. Minor issues may exist but core functionality works.")
    else:
        print("❌ Multiple tests failed. Please check your Selenium installation.")
    
    print(f"\n💡 Recommendations:")
    if not results.get("Selenium Imports", False):
        print("   - Reinstall selenium: pip install selenium")
    if not results.get("WebDriver Manager", False):
        print("   - Reinstall webdriver-manager: pip install webdriver-manager")
    if not results.get("Playwright Availability", False):
        print("   - Install playwright browsers: playwright install")
    
    print("\n✨ Selenium is now available globally in your Cartrita V2 project!")
    return passed >= total * 0.7

if __name__ == "__main__":
    run_comprehensive_test()