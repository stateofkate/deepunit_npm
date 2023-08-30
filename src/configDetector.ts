import path from 'path';
import { rootDir } from './main';
import { grabFromConfig } from './utils';
import * as fs from 'fs';

// Find the where the package.json file is located
///If your package.json is not in the root directory set this to the directory it is located in.
// The autodetect Function will reset it to the root directory if package.json is not found in the directory specified
export function detectWorkspaceDir(): string {
  // go to the current working directory
  process.chdir(rootDir);
  // Check if the configuration file exists
  let configWorkspaceDir = grabFromConfig('workspaceDir');
  const packageJson = 'package.json';
  let packageJsonPath = packageJson;
  if (configWorkspaceDir) {
    packageJsonPath = path.join(configWorkspaceDir, 'package.json');
  }

  if (configWorkspaceDir && fs.existsSync(packageJsonPath)) {
    // If package.json exists, leave workspaceDir as it is
    return configWorkspaceDir;
  } else if (fs.existsSync(packageJson)) {
    // Looks like it wasn't in the config path, but is in the current working directory, reset workspaceDir
    return '';
  } else {
    console.error('Unable to find package.json at ' + packageJsonPath);
    console.error('Current working directory is ' + process.cwd());
    console.error(
      'Please resolve the path and update the workspaceDir in deepunit.config.json',
    );
    // EXIT the program
    process.exit(1);
  }
}
