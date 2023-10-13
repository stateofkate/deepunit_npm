import fs from 'fs';
import path from 'path';

// Get the root package.json of the project where this package is installed
const rootPackageJsonPath = path.resolve(process.cwd(), 'package.json');
fs.readFile(rootPackageJsonPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading root package.json:', err);
    return;
  }

  const rootPackage = JSON.parse(data);

  if (rootPackage.name === 'deepunit') {
    console.log('Skipping postinstall actions because in deepunit package');
  } else {
    installPackage();
  }
});

function installPackage() {
  console.log('Running postinstall actions...');

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
    console.error(`${configPath} does not exist in the current directory ${process.cwd()}`);
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
  //todo: we need to check it package.jest.testRegex is set, if so we should use either .spec or .test when we give the files names
}
