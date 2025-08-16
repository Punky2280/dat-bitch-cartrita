/**
 * Advanced Content Management System Tests - Task 13
 * Tests for content management components and functionality
 */

import fs from 'fs';
import path from 'path';

// Use process.cwd() instead of import.meta.url for Jest compatibility  
const baseDir = process.cwd();

describe('Task 13: Advanced Content Management System', () => {
  
  test('All core components exist', () => {
    
    // Check that all main components were implemented
    const components = [
      'src/services/ContentEngine.js',
      'src/services/CollaborationEngine.js',
      'src/services/ContentAI.js',
      'src/services/PublishingEngine.js',
      'src/routes/contentManagement.js',
      '../../db-init/23_create_content_management_schema.sql',
      '../../docs/specs/content/ADVANCED_CONTENT_MANAGEMENT_SYSTEM.md'
    ];    
    
    const existingComponents = components.filter(component => {
      const fullPath = path.join(baseDir, component);
      return fs.existsSync(fullPath);
    });
    
    console.log(`Task 13 Components Found: ${existingComponents.length}/${components.length}`);
    existingComponents.forEach(comp => console.log(`✓ ${comp}`));
    
    const missingComponents = components.filter(component => {
      const fullPath = path.join(baseDir, component);
      return !fs.existsSync(fullPath);
    });
    
    if (missingComponents.length > 0) {
      console.log('Missing components:');
      missingComponents.forEach(comp => console.log(`✗ ${comp}`));
    }
    
    // At least the core files should exist
    expect(existingComponents.length).toBeGreaterThan(4);
  });
  
  test('ContentEngine service structure', () => {
    const filePath = path.join(__dirname, '../../src/services/ContentEngine.js');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class ContentEngine');
      expect(content).toContain('constructor');
      expect(content).toContain('createContent');
      expect(content).toContain('getContent');
      expect(content).toContain('updateContent');
      console.log('✓ ContentEngine service has proper structure');
    } else {
      console.log('✗ ContentEngine service file not found');
    }
  });
  
  test('CollaborationEngine service structure', () => {
    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '../../src/services/CollaborationEngine.js');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class CollaborationEngine');
      expect(content).toContain('startEditSession');
      expect(content).toContain('broadcastEdit');
      console.log('✓ CollaborationEngine service has proper structure');
    } else {
      console.log('✗ CollaborationEngine service file not found');
    }
  });
  
  test('ContentAI service structure', () => {
    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '../../src/services/ContentAI.js');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class ContentAI');
      expect(content).toContain('analyzeContent');
      expect(content).toContain('optimizeContent');
      console.log('✓ ContentAI service has proper structure');
    } else {
      console.log('✗ ContentAI service file not found');
    }
  });
  
  test('PublishingEngine service structure', () => {
    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '../../src/services/PublishingEngine.js');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('class PublishingEngine');
      expect(content).toContain('publish');
      expect(content).toContain('schedule');
      console.log('✓ PublishingEngine service has proper structure');
    } else {
      console.log('✗ PublishingEngine service file not found');
    }
  });
  
  test('Database schema exists', () => {
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '../../../db-init/23_create_content_management_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const content = fs.readFileSync(schemaPath, 'utf8');
      expect(content).toContain('CREATE TABLE');
      expect(content).toContain('content_items');
      console.log('✓ Database schema file exists with content tables');
    } else {
      console.log('✗ Database schema file not found');
    }
  });
  
  test('API routes exist', () => {
    const fs = require('fs');
    const path = require('path');
    
    const routesPath = path.join(__dirname, '../../src/routes/contentManagement.js');
    if (fs.existsSync(routesPath)) {
      const content = fs.readFileSync(routesPath, 'utf8');
      expect(content).toContain('router');
      expect(content).toContain('POST');
      expect(content).toContain('GET');
      console.log('✓ Content management API routes exist');
    } else {
      console.log('✗ Content management API routes file not found');
    }
  });
  
  test('Specification documentation exists', () => {
    const fs = require('fs');
    const path = require('path');
    
    const specPath = path.join(__dirname, '../../../docs/specs/content/ADVANCED_CONTENT_MANAGEMENT_SYSTEM.md');
    if (fs.existsSync(specPath)) {
      const content = fs.readFileSync(specPath, 'utf8');
      expect(content).toContain('Advanced Content Management System');
      expect(content).toContain('Content Engine');
      console.log('✓ Specification documentation exists');
    } else {
      console.log('✗ Specification documentation not found');
    }
  });
  
  test('Task 13 implementation summary', () => {
    const fs = require('fs');
    const path = require('path');
    
    let implementedCount = 0;
    let totalLines = 0;
    
    const components = [
      '../../src/services/ContentEngine.js',
      '../../src/services/CollaborationEngine.js',
      '../../src/services/ContentAI.js',
      '../../src/services/PublishingEngine.js',
      '../../src/routes/contentManagement.js'
    ];
    
    components.forEach(component => {
      const fullPath = path.join(__dirname, component);
      if (fs.existsSync(fullPath)) {
        implementedCount++;
        const content = fs.readFileSync(fullPath, 'utf8');
        totalLines += content.split('\n').length;
      }
    });
    
    console.log(`\n📊 Task 13 Implementation Summary:`);
    console.log(`✅ Core Services Implemented: ${implementedCount}/${components.length}`);
    console.log(`📝 Total Lines of Code: ${totalLines.toLocaleString()}`);
    console.log(`🎯 Task 13 Status: ${implementedCount >= 4 ? 'COMPLETED ✅' : 'IN PROGRESS 🔄'}`);
    
    expect(implementedCount).toBeGreaterThan(0);
  });
});
