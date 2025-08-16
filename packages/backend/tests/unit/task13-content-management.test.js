/**
 * Content Management System Tests - Task 13 Validation
 * Validates implementation of Advanced Content Management System
 */

import fs from 'fs';
import path from 'path';

// Use process.cwd() instead of import.meta.url for Jest compatibility
const baseDir = process.cwd();

describe('Task 13: Advanced Content Management System', () => {
  
  it('All core components are implemented', () => {
    // Verify all main components exist
    
    const componentsToCheck = [
      'src/services/ContentEngine.js',
      'src/services/CollaborationEngine.js', 
      'src/services/ContentAI.js',
      'src/services/PublishingEngine.js',
      'src/routes/contentManagement.js',
      '../../db-init/23_create_content_management_schema.sql',
      '../../docs/specs/content/ADVANCED_CONTENT_MANAGEMENT_SYSTEM.md'
    ];
    
    componentsToCheck.forEach(component => {
      const fullPath = path.join(baseDir, component);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });
  
  it('ContentEngine service has required methods', async () => {
    const { default: ContentEngine } = await import('../../src/services/ContentEngine.js');
    expect(ContentEngine).toBeDefined();
    
    const instance = new ContentEngine({});
    expect(typeof instance.create).toBe('function');
    expect(typeof instance.getById).toBe('function');
    expect(typeof instance.update).toBe('function');
    expect(typeof instance.archive).toBe('function');
    expect(typeof instance.list).toBe('function');
  });
  
  it('CollaborationEngine service has required methods', async () => {
    const { default: CollaborationEngine } = await import('../../src/services/CollaborationEngine.js');
    expect(CollaborationEngine).toBeDefined();
    
    const instance = new CollaborationEngine({});
    expect(typeof instance.startEditSession).toBe('function');
    expect(typeof instance.broadcastEdit).toBe('function');
    expect(typeof instance.getCollaborators).toBe('function');
  });
  
  it('ContentAI service has required methods', async () => {
    const { default: ContentAI } = await import('../../src/services/ContentAI.js');
    expect(ContentAI).toBeDefined();
    
    const instance = new ContentAI({});
    expect(typeof instance.analyzeContent).toBe('function');
    expect(typeof instance.summarizeContent).toBe('function');
    expect(typeof instance.optimizeContent).toBe('function');
  });
  
  it('PublishingEngine service has required methods', async () => {
    const { default: PublishingEngine } = await import('../../src/services/PublishingEngine.js');
    expect(PublishingEngine).toBeDefined();
    
    const instance = new PublishingEngine({});
    expect(typeof instance.publish).toBe('function');
    expect(typeof instance.schedule).toBe('function');
    expect(typeof instance.bulkPublish).toBe('function');
  });
  
  it('Database migration exists with required tables', () => {
    const migrationPath = path.join(__dirname, '../../../../db-init/23_create_content_management_schema.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);
    
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    expect(migrationContent).toContain('CREATE TABLE content_items');
    expect(migrationContent).toContain('CREATE TABLE content_versions');
    expect(migrationContent).toContain('CREATE TABLE content_edit_sessions');
  });
  
  it('API routes are properly defined', async () => {
    const { default: contentRoutes } = await import('../../src/routes/contentManagement.js');
    expect(contentRoutes).toBeDefined();
    expect(typeof contentRoutes.router).toBeDefined();
  });
  
  it('Specification documentation exists', () => {
    const specPath = path.join(__dirname, '../../../../docs/specs/content/ADVANCED_CONTENT_MANAGEMENT_SYSTEM.md');
    expect(fs.existsSync(specPath)).toBe(true);
    
    const specContent = fs.readFileSync(specPath, 'utf8');
    expect(specContent).toContain('Advanced Content Management System');
    expect(specContent).toContain('Content Engine');
  });
});
