const fs = require('fs');
const path = require('path');

function traverseAndRestructure(dir) {
  const entries = fs.readdirSync(dir);

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      // Recursively process subdirectories.
      traverseAndRestructure(fullPath);
    } else {
      // Decide on target folder based on file extension.
      const ext = path.extname(entry).toLowerCase();
      let targetSubfolder;
      if (ext === '.css') {
        targetSubfolder = 'styles';
      } else if (
        ext === '.js' ||
        ext === '.jsx' ||
        ext === '.ts' ||
        ext === '.tsx'
      ) {
        targetSubfolder = 'scripts';
      } else if (ext === '.html') {
        targetSubfolder = 'html';
      }

      if (targetSubfolder) {
        // Ensure the target directory exists.
        const targetDir = path.join(dir, targetSubfolder);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Construct the new file path.
        const targetPath = path.join(targetDir, entry);

        // Prevent moving a file if it's already in the target directory.
        if (fullPath !== targetPath) {
          console.log(`Moving ${fullPath} to ${targetPath}`);
          fs.renameSync(fullPath, targetPath);
        }
      }
    }
  });
}

const rootDir = process.argv[2] || process.cwd();
console.log(`Re-structuring files from root: ${rootDir}`);
traverseAndRestructure(rootDir);
console.log('Restructure complete.');
