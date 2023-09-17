import path from 'path';
import * as fs from 'fs';
import ts from 'typescript';
import { TestingFrameworks } from '../main.consts';

// HARDCODED CONFIG VALUES
const configFilePaths = ['deepunit.dev.config.json', 'deepunit.config.json']; // in order of importance
const prodBase = 'https://dumper.adaptable.app';
const localHostBase = 'http://localhost:8080';

export const maxFixFailingTestAttempts = 7;
export const rootDir = process.cwd();

/** Automatically Detected Project configs
 * These configs are first pulled from deepunit.config.json, if absent we will try to use the detect*() Function to autodetect
 */
class Config {
  workspaceDir: string = '';
  frontendFramework: string = '';
  testExtension: string = '';
  testingFramework: TestingFrameworks = TestingFrameworks.unknown;
  scriptTarget: string = '';
  typescriptExtension: string = '';
  password: string = 'nonerequired';
  doProd: boolean = true;
  apiHost: string = '';
  version: string = '';
  ignoredDirectories: string[] = [];
  ignoredFiles: string[] = [];
  includeFailingTests: boolean = true;
  generateChangedFilesOnly = false;

  constructor() {
    this.detectWorkspaceDir();
    this.detectProjectType();
    this.detectTsconfigTarget();
    this.detectTestFramework();

    this.typescriptExtension = Config.getStringFromConfig('typescriptExtension') ?? '.ts';
    this.password = Config.getStringFromConfig('password') || 'nonerequired';
    this.doProd = Config.getStringFromConfig('doProd') === 'true';
    this.ignoredDirectories = Config.getArrayFromConfig('ignoredDirectories');
    this.ignoredFiles = Config.getArrayFromConfig('ignoredFiles');
    this.apiHost = this.doProd ? prodBase : localHostBase;
    this.version = process.env.npm_package_version ?? '0.0.0';
    this.includeFailingTests = Config.getStringFromConfig('includeFailingTests') != 'false';
    this.generateChangedFilesOnly = Config.getStringFromConfig('generateChangedFilesOnly') == 'true';
  }

  // Find the where the package.json file is located
  /// If your package.json is not in the root directory set this to the directory it is located in.
  // The autodetect Function will reset it to the root directory if package.json is not found in the directory specified

  // TODO: this isn't right, we need the ability for the user to either select which folder they want to run ?????
  detectWorkspaceDir(): void {
    // go to the current working directory
    process.chdir(rootDir);
    // Check if the configuration file exists
    let configWorkspaceDir = Config.getStringFromConfig('workspaceDir');
    const packageJson = 'package.json';
    let packageJsonPath = packageJson;
    if (configWorkspaceDir) {
      packageJsonPath = path.join(configWorkspaceDir, 'package.json');
    }

    if (configWorkspaceDir && fs.existsSync(packageJsonPath)) {
      // If package.json exists, leave workspaceDir as it is
      this.workspaceDir = configWorkspaceDir;
      return;
    } else if (fs.existsSync(packageJson)) {
      // Looks like it wasn't in the config path, but is in the current working directory, reset workspaceDir
      return;
    } else {
      console.error('Unable to find package.json at ' + packageJsonPath);
      console.error('Current working directory is ' + process.cwd());
      console.error('Please resolve the path and update the workspaceDir in deepunit.config.json');
      process.exit(1);
    }
  }

  private detectProjectType(): void {
    process.chdir(rootDir);
    const configValue = Config.getStringFromConfig('frontendFramework');
    if (configValue) {
      this.frontendFramework = configValue;
      return;
    }
    let angularJsonPath = 'angular.json';
    let packageJsonPath = 'package.json';

    // If workspaceDir is not empty, join the path
    if (this.workspaceDir) {
      angularJsonPath = path.join(this.workspaceDir, 'angular.json');
      packageJsonPath = path.join(this.workspaceDir, 'package.json');
    }

    if (fs.existsSync(angularJsonPath)) {
      this.frontendFramework = 'angular';
      return;
    } else if (fs.existsSync(packageJsonPath)) {
      let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      let dependencies = packageJson['dependencies'] || {};
      let devDependencies = packageJson['devDependencies'] || {};
      if ('react' in dependencies || 'react' in devDependencies) {
        this.frontendFramework = 'react';
        return;
      }
      if ('angular/common' in dependencies || 'angular/common' in devDependencies) {
        this.frontendFramework = 'angular';
        return;
      }
    }
    // Unable to find the framework
    console.log('WARNING: Unable to detect frontend framework, typescript extension');
    this.frontendFramework = 'unknown';
  }

  private detectTestFramework(): void {
    let jestConfigPath = 'jest.config.js';
    let karmaConfigPath = 'karma.conf.js';
    let packageJsonPath = 'package.json';

    // If workspaceDir is not empty, join the path
    if (this.workspaceDir) {
      jestConfigPath = path.join(this.workspaceDir, 'jest.config.js');
      karmaConfigPath = path.join(this.workspaceDir, 'karma.conf.js');
      packageJsonPath = path.join(this.workspaceDir, 'package.json');
    }

    if (fs.existsSync(jestConfigPath)) {
      this.testingFramework = TestingFrameworks.jest;
      this.testExtension = '.test.ts';
    } else if (fs.existsSync(karmaConfigPath)) {
      this.testingFramework = TestingFrameworks.jasmine;
      this.testExtension = '.spec.ts';
    } else if (fs.existsSync(packageJsonPath)) {
      let fileContent = fs.readFileSync(packageJsonPath, 'utf8');
      if (fileContent.includes('jest')) {
        this.testingFramework = TestingFrameworks.jest;
        this.testExtension = '.test.ts';
      } else if (fileContent.includes('jasmine-core')) {
        this.testingFramework = TestingFrameworks.jasmine;
        this.testExtension = '.spec.ts';
      }
    }
  }
  private detectTsconfigTarget(): void {
    let tsconfigPath: string | null = path.join(this.workspaceDir, 'tsconfig.json');

    while (tsconfigPath) {
      if (fs.existsSync(tsconfigPath)) {
        let contents: string = fs.readFileSync(tsconfigPath, 'utf8');
        try {
          let tsconfigJson = ts.parseConfigFileTextToJson('', contents);
          this.scriptTarget = tsconfigJson.config?.compilerOptions?.target ? tsconfigJson.config?.compilerOptions?.target : undefined;
          if (tsconfigPath != null) {
            // @ts-ignore
            tsconfigPath = tsconfigJson.config?.extends ? path.join(path.dirname(tsconfigPath), tsconfigJson.config?.extends) : null;
          }
        } catch (error) {
          console.log(error);
          process.exit(1);
        }
      } else {
        console.error('Error: unable to find tsconfig at ' + tsconfigPath);
        console.error('The current working director is ' + process.cwd());
        process.exit(1);
      }
    }
  }

  /**
   * Get an array value from config (supports all sub-types of array)
   */
  public static getArrayFromConfig(configProperty: string): string[] {
    const configVal = Config.getValueFromConfigFile(configProperty);
    if (configVal && Array.isArray(configVal)) {
      return configVal;
    }

    return [];
  }

  /**
   * Get an string value from config (even if the value is something else, we convert to string)
   */
  public static getStringFromConfig(configProperty: string): string {
    const configVal = Config.getValueFromConfigFile(configProperty);
    if (configVal) {
      return configVal.toString();
    }

    return '';
  }

  /**
   * HELPER FUNCTION: Get the json value from config
   */
  private static getValueFromConfigFile(configProperty: string): unknown {
    for (let configPath of configFilePaths) {
      if (fs.existsSync(configPath)) {
        let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (configProperty in config) {
          let configValue = config[configProperty];
          return configValue;
        }
      }
    }
  }
}

export const CONFIG = new Config();
