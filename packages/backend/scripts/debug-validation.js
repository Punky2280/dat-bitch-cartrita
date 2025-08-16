#!/usr/bin/env node

/**
 * Debug Validation Script
 * Quick test of ES6 compliance for specific file
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testValidation() {
    const filePath = path.join(__dirname, '../src/services/WorkflowTemplateLibraryService.js');
    const content = await fs.readFile(filePath, 'utf-8');
    
    const hasES6Import = /^import\s+.*\s+from\s+/m.test(content) || /^import\s+['"']/m.test(content);
    const hasES6Export = /^export\s+/m.test(content);
    const hasCommonJS = /require\s*\(|module\.exports|exports\./.test(content);
    
    console.log('File:', 'WorkflowTemplateLibraryService.js');
    console.log('hasES6Import:', hasES6Import);
    console.log('hasES6Export:', hasES6Export);
    console.log('hasCommonJS:', hasCommonJS);
    console.log('compliant:', hasES6Import && hasES6Export && !hasCommonJS);
    
    // Show first 20 lines
    const lines = content.split('\n');
    console.log('\nFirst 20 lines:');
    lines.slice(0, 20).forEach((line, i) => {
        console.log(`${i + 1}: ${line}`);
    });
    
    // Show exports
    console.log('\nExport lines:');
    lines.forEach((line, i) => {
        if (line.includes('export ')) {
            console.log(`${i + 1}: ${line}`);
        }
    });
}

testValidation().catch(console.error);
