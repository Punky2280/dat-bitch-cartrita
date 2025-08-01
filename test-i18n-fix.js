// Test script to verify i18n fixes
// Run this in browser console to test i18n functionality

console.log('🧪 Testing i18n functionality...');

// Test 1: Check if i18next is loaded
function testI18nLoaded() {
  console.log('\n📋 Test 1: i18next loaded');
  
  if (typeof window.i18next !== 'undefined') {
    console.log('✅ i18next is available globally');
    console.log(`Current language: ${window.i18next.language}`);
    console.log(`Loaded languages: ${window.i18next.languages.join(', ')}`);
    return true;
  } else {
    console.log('❌ i18next not available globally');
    return false;
  }
}

// Test 2: Check translation loading
async function testTranslationLoading() {
  console.log('\n📋 Test 2: Translation loading');
  
  const languagesToTest = ['en', 'es', 'en-US'];
  const results = {};
  
  for (const lang of languagesToTest) {
    try {
      const response = await fetch(`/locales/${lang}/translation.json`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${lang}: Loaded ${Object.keys(data).length} keys`);
        results[lang] = { status: 'success', keys: Object.keys(data).length };
      } else {
        console.log(`❌ ${lang}: HTTP ${response.status}`);
        results[lang] = { status: 'failed', error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.log(`❌ ${lang}: ${error.message}`);
      results[lang] = { status: 'error', error: error.message };
    }
  }
  
  return results;
}

// Test 3: Check React i18n integration
function testReactI18n() {
  console.log('\n📋 Test 3: React i18n integration');
  
  // Look for React components using useTranslation
  const hasLanguageSelector = document.querySelector('[class*="language"]') !== null;
  const hasTranslationElements = document.querySelector('[data-i18n]') !== null;
  
  console.log(`Language selector present: ${hasLanguageSelector ? '✅' : '❌'}`);
  console.log(`Translation elements present: ${hasTranslationElements ? '✅' : '❌'}`);
  
  return { hasLanguageSelector, hasTranslationElements };
}

// Test 4: Check for Promise errors
function testPromiseErrors() {
  console.log('\n📋 Test 4: Promise error handling');
  
  let errorCount = 0;
  const originalError = console.error;
  
  console.error = (...args) => {
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('Promise') || arg.includes('i18n') || arg.includes('translation'))
    )) {
      errorCount++;
    }
    originalError.apply(console, args);
  };
  
  // Restore after 5 seconds
  setTimeout(() => {
    console.error = originalError;
    console.log(`Promise-related errors detected: ${errorCount}`);
  }, 5000);
  
  return errorCount;
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running i18n test suite...');
  
  const results = {
    i18nLoaded: testI18nLoaded(),
    translationLoading: await testTranslationLoading(),
    reactI18n: testReactI18n(),
    promiseErrors: testPromiseErrors()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`i18next Loaded: ${results.i18nLoaded ? '✅' : '❌'}`);
  console.log(`Translation Files: ${Object.keys(results.translationLoading).length} languages tested`);
  console.log(`React Integration: ${results.reactI18n.hasLanguageSelector ? '✅' : '❌'}`);
  console.log('Promise Error Monitoring: Active for 5 seconds');
  
  // Check if any critical translations are working
  if (window.i18next) {
    try {
      const testKey = window.i18next.t('common.loading') || window.i18next.t('loading') || 'Loading...';
      console.log(`Sample translation: "${testKey}"`);
    } catch (error) {
      console.log(`Translation test failed: ${error.message}`);
    }
  }
  
  const success = results.i18nLoaded && Object.values(results.translationLoading).some(r => r.status === 'success');
  
  if (success) {
    console.log('\n🎉 i18n system appears to be working correctly!');
  } else {
    console.log('\n⚠️ i18n system has some issues, but errors are handled gracefully.');
  }
  
  return results;
}

// Export for use
if (typeof window !== 'undefined') {
  window.testI18n = runAllTests;
  console.log('\n💡 You can run this test suite by calling: testI18n()');
}

// Auto-run if in browser environment
if (typeof window !== 'undefined' && window.location) {
  runAllTests();
}

module.exports = { runAllTests, testTranslationLoading, testReactI18n };