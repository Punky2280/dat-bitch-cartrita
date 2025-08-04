const fs = require('fs');
const path = require('path');

function fixSpecificIssues(filePath) {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Fix no-unused-vars by removing unused imports/variables
  const lines = content.split('\n');
  const fixedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fix prefer-const: change 'let' to 'const' for variables that are never reassigned
    if (line.includes('let ') && !line.includes('//')) {
      const varMatch = line.match(/let\s+(\w+)/);
      if (varMatch) {
        const varName = varMatch[1];
        const restOfFile = lines.slice(i + 1).join('\n');
        // If variable is never reassigned (no standalone assignment), use const
        const reassignmentPattern = new RegExp(`^\\s*${varName}\\s*=`, 'm');
        if (!reassignmentPattern.test(restOfFile)) {
          line = line.replace(/\blet\b/, 'const');
          modified = true;
        }
      }
    }

    // Fix no-useless-escape: remove unnecessary escapes
    if (line.includes('\\/') && !line.includes('//')) {
      line = line.replace(/\\\//g, '/');
      modified = true;
    }

    fixedLines.push(line);
  }

  if (modified) {
    content = fixedLines.join('\n');
    fs.writeFileSync(filePath, content);
    console.log(`Fixed specific issues in: ${filePath}`);
  }
}

function getAllJSFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !item.startsWith('.') &&
        item !== 'node_modules'
      ) {
        files.push(...getAllJSFiles(fullPath));
      } else if (stat.isFile() && item.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.log(`Error reading directory ${dir}: ${error.message}`);
  }

  return files;
}

const jsFiles = getAllJSFiles('packages/backend/src');
console.log(
  `Processing ${jsFiles.length} JavaScript files for specific fixes...`
);

jsFiles.forEach(fixSpecificIssues);
console.log('Specific issue fixes completed');
