import path from 'path';
import * as fs from 'fs';
import ts from 'typescript';
import { TestingFrameworks } from '../main.consts';
import { exitWithError, getGenerateAllFilesFlag, getYesOrNoAnswer, installPackage } from './utils';
import { execSync } from 'child_process';
import { Color } from './Printer';
const devConfig: string = 'deepunit.dev.config.json';

// HARDCODED CONFIG VALUES
const configFilePaths = [devConfig, 'deepunit.config.json']; // in order of importance
const prodBase = 'https://dumper.adaptable.app';
const localHostBase = 'http://localhost:8080';

export const maxFixFailingTestAttempts = 2;

/** Automatically Detected Project configs
 * These configs are first pulled from deepunit.config.json, if absent we will try to use the detect*() Function to autodetect
 */
export class Config {
  frontendFramework: string = '';
  testSuffix: string = '';
  testingFramework: TestingFrameworks = TestingFrameworks.unknown;
  scriptTarget: string = '';
  doProd: boolean;
  apiHost: string = '';
  version: string;
  ignoredDirectories: string[] = [];
  ignoredFiles: string[] = [];
  includeFailingTests: boolean = true;
  generateAllFiles: boolean;
  isDevBuild: boolean = false;
  prodTesting: boolean = false;
  testingLanguageOverride: string = '';
  isGitRepository: boolean = false;

  constructor() {
    this.detectProjectType();
    this.determineDevBuild();

    this.detectTestFramework();
    const testingFrameworkOverride = Config.getStringFromConfig('testingFramework');
    if (testingFrameworkOverride && (Object.values(TestingFrameworks) as string[]).includes(testingFrameworkOverride)) {
      this.testingFramework = testingFrameworkOverride as TestingFrameworks;
    }

    this.scriptTarget = this.getsConfigTarget() ?? 'ESNext';
    this.prodTesting = Config.getBoolFromConfig('prodTesting');
    this.version = this.getVersion();
    this.doProd = Config.getBoolFromConfig('doProd', true);
    this.ignoredDirectories = Config.getArrayFromConfig('ignoredDirectories');
    this.ignoredFiles = Config.getArrayFromConfig('ignoredFiles');
    this.apiHost = this.doProd ? prodBase : localHostBase;
    this.includeFailingTests = Config.getBoolFromConfig('includeFailingTests', true);
    this.generateAllFiles = getGenerateAllFilesFlag();
    this.testingLanguageOverride = Config.getStringFromConfig('testingLanguageOverride');
    this.isGitRepository = this.isInGitRepo();
  }

  /**
   * Get an boolean value from config (default to false, if the value is not exactly true, we also return false)
   */
  private static getBoolFromConfig(configProperty: string, defaultVal = false): boolean {
    const configVal = Config.getValueFromConfigFile(configProperty);
    return typeof configVal === 'boolean' ? configVal : defaultVal;
  }

  private getVersion(): string {
    const packageJson = require('../../package.json');
    const version = packageJson?.version;
    if (version) {
      return version;
    } else {
      exitWithError('Unable to detect DeepUnit version, this should never happen.'); //should never happen but in case
      return ''; //Typescrip wants a return even tho we are going to process.exit()
    }
  }

  private isInGitRepo(): boolean {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
      return true;
    } catch (error: any) {
      if (error.message && typeof error.message === 'string' && error.message.includes('not a git repository')) {
        return false;
      }
      throw error; // If the error is something else, we might want to rethrow it.
    }
  }

  private detectProjectType(): void {
    const configValue = Config.getStringFromConfig('frontendFramework');
    if (configValue) {
      this.frontendFramework = configValue;
      return;
    }
    let angularJsonPath = 'angular.json';
    let packageJsonPath = 'package.json';

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
    this.frontendFramework = '';
  }

  private determineDevBuild() {
    if (fs.existsSync(devConfig) && !this.prodTesting) {
      this.isDevBuild = true;
    } else if (fs.existsSync(devConfig) && this.prodTesting) {
      console.log('DeepUnit is running in production testing mode');
    }
  }

  private detectTestFramework(): void {
    let jestConfigPath = 'jest.config.js';
    let karmaConfigPath = 'karma.conf.js';
    let packageJsonPath = 'package.json';

    if (fs.existsSync(jestConfigPath)) {
      this.testingFramework = TestingFrameworks.jest;
      this.testSuffix = 'test';
    } else if (fs.existsSync(karmaConfigPath)) {
      this.testingFramework = TestingFrameworks.jasmine;
      this.testSuffix = 'spec';
    } else if (fs.existsSync(packageJsonPath)) {
      let fileContent = fs.readFileSync(packageJsonPath, 'utf8');
      if (fileContent.includes('jest')) {
        this.testingFramework = TestingFrameworks.jest;
        this.testSuffix = 'test';
      } else if (fileContent.includes('jasmine-core')) {
        this.testingFramework = TestingFrameworks.jasmine;
        this.testSuffix = 'spec';
      }
    }

    if (!this.testSuffix) {
      this.testSuffix = 'test';
    }
  }

  private getsConfigTarget(): string | undefined {
    let tsconfigPath: string | undefined = 'tsconfig.json';

    while (tsconfigPath) {
      if (fs.existsSync(tsconfigPath)) {
        let contents: string = fs.readFileSync(tsconfigPath, 'utf8');
        try {
          let tsconfigJson = ts.parseConfigFileTextToJson('', contents);
          const scriptTarget = tsconfigJson.config?.compilerOptions?.target;
          if (scriptTarget) {
            return scriptTarget;
          }
          if (tsconfigPath != null) {
            // @ts-ignore
            tsconfigPath = tsconfigJson.config?.extends ? path.join(path.dirname(tsconfigPath), tsconfigJson.config?.extends) : null;
          }
        } catch (error) {
          console.error(error);
          exitWithError('Unable to read the tsconfig');
        }
      } else {
        tsconfigPath = undefined;
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

  public async confirmAllPackagesNeeded() {
    if (this.frontendFramework == 'react') {
      // if it is version 18, let them deal with dependencies
      if (this.confirmRunningReactVersion18()) {
        return;
      }

      const requiredPackaged = [
        { name: '@testing-library/react', installVersion: 'release-12.x' },
        { name: '@testing-library/react-hooks' },
        { name: 'react-router-dom', installVersion: 'classic' },
      ];

      let neededPackages = [];
      for (let requiredPackage of requiredPackaged) {
        if (!this.getPackageVersionIfInstalled(requiredPackage.name)) {
          neededPackages.push(requiredPackage);
        }
      }

      // if missing packages, request to install them
      if (neededPackages.length > 0) {
        console.log(`In order to generate unit tests for ${this.frontendFramework}, we require the following dev dependencies to be installed:\n`);
        neededPackages.forEach((p) => console.log(' - ' + p.name));
        const wantsToInstallDependencies = await getYesOrNoAnswer('Install Required Packages?');
        if (wantsToInstallDependencies) {
          const remappedPacks = neededPackages.map((p) => (p.installVersion ? `${p.name}@${p.installVersion}` : p.name));
          installPackage(remappedPacks.join(' '), true);
        } else {
          console.error(
            Color.yellow(
              'Packages are required to run tests, please install the missing packages or enable includeFailingTests in the config, so you can manage the dependencies yourself.',
            ),
          );
        }
      }
    }
  }

  // REACT KLUDGE: we do not support react 18 yet
  private confirmRunningReactVersion18(): boolean {
    const reactVersion = this.getPackageVersionIfInstalled('react');
    const versionRegex = new RegExp(/([\d.]+)/);
    if (!reactVersion) {
      console.warn('React is a missing dependency, yet we assume you are using react. There is an issue, please check your config that you are not forcing it to be react.');
    } else {
      const versionNumbers = reactVersion.match(versionRegex);
      if (versionNumbers && versionNumbers[0].split('.') && versionNumbers[0].split('.').length == 3 && !isNaN(+versionNumbers[0].split('.')[0])) {
        const number = versionNumbers[0].split('.')[0];
        if (+number >= 18) {
          console.warn(Color.yellow('We currently do not support react version 18 and above. You may continue although imports might not work right.'));
          return true;
        }
      } else {
        console.error('Unable to parse react version number.');
      }
    }
    return false;
  }

  private getPackageVersionIfInstalled(requiredPackaged: string): string | null {
    let packageJsonPath = 'package.json';

    if (fs.existsSync(packageJsonPath)) {
      let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      let dependencies = packageJson['dependencies'] || {};
      let devDependencies = packageJson['devDependencies'] || {};
      if (requiredPackaged in dependencies) {
        return dependencies[requiredPackaged];
      }
      if (requiredPackaged in devDependencies) {
        return devDependencies[requiredPackaged];
      }
    }

    return null;
  }
}
