#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const configPath = 'deepunit.config.json';
const targetPath = path.join('..', '..', configPath);
const packageJsonPath = path.join('..', '..', 'package.json');

// Check if deepunit.config.json exists in the current directory
if (fs.existsSync(configPath) && !fs.existsSync(targetPath)) {
  // Move the file
  fs.rename(configPath, targetPath, (err) => {
    if (err) {
      console.error(`Error moving ${configPath}:`, err);
    } else {
      console.log(`${configPath} moved to ${targetPath}`);
    }
  });
} else if (!fs.existsSync(configPath)) {
  console.error(`${configPath} does not exist in the current directory.`);
}

// Check if package.json exists
if (fs.existsSync(packageJsonPath)) {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Modify package.json (example: add a new script)
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts.deepunit = 'deepunit';

  // Write package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`Added "deepunit" script to ${packageJsonPath}`);
} else {
  console.error(`${packageJsonPath} does not exist.`);
}

/*
import fs from 'fs';
const packagePath = '../../package.json';
if (fs.existsSync(packagePath)) {
  const packy = fs.readFileSync(packagePath);
} else {
  console.error('no packy');
}
console.error('instally woooooo');

fs.writeFileSync('asfgsdfgsdgrwetghwrthwathaqty34tggsdgrwetghwrthwathaqty34tggsdgrwetghwrthwathaqty34tggsdgrwetghwrthwathaqty34tgq35reergerQ.ts', 'fgasfg');
process.exit(1);
*/
