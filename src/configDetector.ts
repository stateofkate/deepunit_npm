import path from 'path';
import { Config, debug, rootDir } from './main';
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

export function detectProjectType(config: Config): string {
  process.chdir(rootDir);
  const configValue = grabFromConfig('frontendFramework');
  if (configValue) {
    return configValue;
  }
  let angularJsonPath = 'angular.json';
  let packageJsonPath = 'package.json';

  // If workspaceDir is not empty, join the path
  if (config.workspaceDir) {
    angularJsonPath = path.join(config.workspaceDir, 'angular.json');
    packageJsonPath = path.join(config.workspaceDir, 'package.json');
  }

  if (fs.existsSync(angularJsonPath)) {
    return 'angular';
  } else if (fs.existsSync(packageJsonPath)) {
    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    let dependencies = packageJson['dependencies'] || {};
    let devDependencies = packageJson['devDependencies'] || {};
    if ('react' in dependencies || 'react' in devDependencies) {
      return 'react';
    }
    if (
      'angular/common' in dependencies ||
      'angular/common' in devDependencies
    ) {
      return 'angular';
    }
  }
  // Unable to find the framework
  debug(
    'WARNING: Unable to detect frontend framework, typescript extension',
    true,
  );
  return 'unknown';
}

export function detectTestFramework(config: Config): {
  testingFramework: string;
  testExtension: string;
} {
  let jestConfigPath = 'jest.config.js';
  let karmaConfigPath = 'karma.conf.js';
  let packageJsonPath = 'package.json';

  // If workspaceDir is not empty, join the path
  if (config.workspaceDir) {
    jestConfigPath = path.join(config.workspaceDir, 'jest.config.js');
    karmaConfigPath = path.join(config.workspaceDir, 'karma.conf.js');
    packageJsonPath = path.join(config.workspaceDir, 'package.json');
  }

  if (fs.existsSync(jestConfigPath)) {
    return {
      testingFramework: 'jest',
      testExtension: '.test.ts',
    };
  } else if (fs.existsSync(karmaConfigPath)) {
    return {
      testingFramework: 'jasmine',
      testExtension: '.spec.ts',
    };
  } else if (fs.existsSync(packageJsonPath)) {
    let fileContent = fs.readFileSync(packageJsonPath, 'utf8');
    if (fileContent.includes('jest')) {
      return {
        testingFramework: 'jest',
        testExtension: '.test.ts',
      };
    } else if (fileContent.includes('jasmine-core')) {
      return {
        testingFramework: 'jasmine',
        testExtension: '.spec.ts',
      };
    }
  }

  return {
    testingFramework: '',
    testExtension: '',
  };
}
