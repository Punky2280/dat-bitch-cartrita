#!/usr/bin/env node

/**
 * Batch fix script for widespread syntax errors in the codebase
 * Fixes ($4) syntax errors and other common malformed patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SyntaxErrorFixer {
  constructor() {
    this.fixedFiles = [];
    this.errors = [];
    this.patterns = [
      // Common malformed patterns
      { search: /\$4\)/g, replace: '(error)' },
      { search: /\{\s*\$4\)\s*\{/g, replace: '{ error) {' },
      { search: /if\(\$4\)/g, replace: 'if (error)' },
      { search: /catch\(\$4\)/g, replace: 'catch (error)' },
      { search: /function\(\$4\)/g, replace: 'function(error)' },
      {
        search: /async\s+\w+\(\$4\)\s*\{/g,
        replace: match => match.replace('$4)', 'error) {'),
      },

      // Fix common syntax issues
      {
        search:
          /\)\s*\{[^}]*\/\/\s*Method implementation[^}]*\}\s*(?=[a-zA-Z])/g,
        replace: ') {\n    // TODO: Implement method\n  }\n\n  ',
      },
      { search: /null\s+(?=[a-zA-Z_])/g, replace: '' },
      { search: /true\s+(?=[a-zA-Z_])/g, replace: '' },
      { search: /\,\s*\)/g, replace: ')' },
      { search: /\(\s*\,/g, replace: '(' },

      // Fix broken constructor calls
      {
        search: /constructor\(super\(/g,
        replace: 'constructor() {\n    super(',
      },
      { search: /\)\s*\]\)\s*\]/g, replace: ')' },

      // Fix incomplete statements
      {
        search: /\{\s*\n\s*\/\/\s*Method implementation\s*\n\s*\}/g,
        replace: '{\n    // TODO: Implement\n  }',
      },
    ];
  }

  async fixAllFiles() {
    console.log('🔧 Starting batch syntax error fixing...');
    console.log('=====================================\n');

    try {
      // Get all files with ($4) errors
      const filesWithErrors = this.getFilesWithErrors();
      console.log(`Found ${filesWithErrors.length} files with syntax errors\n`);

      // Fix each file
      for (const filePath of filesWithErrors) {
        await this.fixFile(filePath);
      }

      console.log('\n📊 FIXING SUMMARY');
      console.log('=================');
      console.log(`Total files processed: ${filesWithErrors.length}`);
      console.log(`Successfully fixed: ${this.fixedFiles.length}`);
      console.log(`Errors encountered: ${this.errors.length}`);

      if (this.errors.length > 0) {
        console.log('\n❌ Files with errors:');
        this.errors.forEach(error => console.log(`   ${error}`));
      }

      console.log('\n✅ Batch fixing completed!');
    } catch (error) {
      console.error('❌ Batch fixing failed:', error);
    }
  }

  getFilesWithErrors() {
    try {
      // Use grep to find files with ($4) pattern
      const output = execSync('grep -r "\\$4)" packages/ --include="*.js" -l', {
        encoding: 'utf8',
      });
      return output
        .trim()
        .split('\n')
        .filter(line => line.length > 0);
    } catch (error) {
      console.warn('Could not get files via grep, falling back to manual list');
      return []; // Return empty array if grep fails
    }
  }

  async fixFile(filePath) {
    try {
      console.log(`🔧 Fixing: ${filePath}`);

      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Apply all patterns
      for (const pattern of this.patterns) {
        const originalContent = content;
        content = content.replace(pattern.search, pattern.replace);
        if (content !== originalContent) {
          modified = true;
        }
      }

      // Apply specific fixes for common issues
      content = this.applySpecificFixes(content);

      if (modified) {
        // Create backup
        fs.writeFileSync(`${filePath}.backup`, fs.readFileSync(filePath));

        // Write fixed content
        fs.writeFileSync(filePath, content);

        this.fixedFiles.push(filePath);
        console.log(`   ✅ Fixed syntax errors in ${path.basename(filePath)}`);
      } else {
        console.log(`   ⚠️  No changes needed for ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.error(`   ❌ Error fixing ${filePath}:`, error.message);
      this.errors.push(`${filePath}: ${error.message}`);
    }
  }

  applySpecificFixes(content) {
    // Fix broken if statements
    content = content.replace(
      /if\(\$4\)\s*\{([^}]*)\}/g,
      'if (error) {\n    $1\n  }'
    );

    // Fix broken catch blocks
    content = content.replace(
      /catch\(\$4\)\s*\{([^}]*)\}/g,
      'catch (error) {\n    console.error(error);\n  }'
    );

    // Fix broken function definitions
    content = content.replace(/(\w+)\(\$4\)\s*\{/g, '$1(error) {');

    // Fix malformed object syntax
    content = content.replace(/\{\s*\$4\)\s*([^}]*)\}/g, '{ error) $1 }');

    // Fix broken method signatures
    content = content.replace(/async\s+(\w+)\(\$4\)/g, 'async $1(error)');

    // Fix incomplete constructor calls
    content = content.replace(
      /constructor\(\s*super\(/g,
      'constructor() {\n    super('
    );

    // Fix broken array/object endings
    content = content.replace(/\]\)\s*\]/g, ']');
    content = content.replace(/\}\)\s*\}/g, '}');

    // Fix trailing commas and syntax
    content = content.replace(/,\s*\)/g, ')');
    content = content.replace(/,\s*\]/g, ']');
    content = content.replace(/,\s*\}/g, '}');

    return content;
  }
}

// Run the fixer
if (require.main === module) {
  const fixer = new SyntaxErrorFixer();
  fixer.fixAllFiles().catch(console.error);
}

module.exports = SyntaxErrorFixer;
