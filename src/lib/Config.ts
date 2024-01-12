import path from 'path';
import * as fs from 'fs';
import ts from 'typescript';
import { TestingFrameworks } from '../main.consts';
import {askQuestion, exitWithError, getGenerateAllFilesFlag, getYesOrNoAnswer, installPackage} from './utils';
import { execSync } from 'child_process';
import { Color } from './Printer';
import {Files} from "./Files";

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
  frontendFramework: string = 'angular';
  frameworkVersion: string = '';
  testSuffix: string = '';
  testingFramework: TestingFrameworks = TestingFrameworks.jasmine;
  scriptTarget: string = '';
  doProd: boolean;
  apiHost: string = '';
  ignoredDirectories: string[] = [];
  ignoredFiles: string[] = [];
  includeFailingTests: boolean = true;
  generateAllFiles: boolean;
  isDevBuild: boolean = false;
  prodTesting: boolean = false;
  testingLanguageOverride: string = '';
  testingFrameworkOverride: string = '';
  isGitRepository: boolean = false;
  retryTestGenerationOnFailure: boolean = true;
  private readonly undefinedVersion = '-1';
  private versionCache: string = this.undefinedVersion;
  platform: string = '';
  defaultBranch: string = ''

  constructor() {
    this.detectProjectType();
    this.determineDevBuild();
    this.detectTestSuffix();
    this.testingFramework = this.getTestFramework();
    this.frameworkVersion = this.getFrameworkVersion();
    this.testingFrameworkOverride = Config.getStringFromConfig('testingFramework');
    if (this.testingFrameworkOverride && (Object.values(TestingFrameworks) as string[]).includes(this.testingFrameworkOverride)) {
      this.testingFramework = this.testingFrameworkOverride as TestingFrameworks;
    }

    this.scriptTarget = this.getsConfigTarget() ?? 'unknown';
    this.prodTesting = Config.getBoolFromConfig('prodTesting');
    this.doProd = Config.getBoolFromConfig('doProd', true);
    this.ignoredDirectories = Config.getArrayFromConfig('ignoredDirectories');
    this.ignoredFiles = Config.getArrayFromConfig('ignoredFiles');
    this.apiHost = this.doProd ? prodBase : localHostBase;
    this.includeFailingTests = Config.getBoolFromConfig('includeFailingTests', true);
    this.retryTestGenerationOnFailure = Config.getBoolFromConfig('retryTestGenerationOnFailure', true);
    this.generateAllFiles = getGenerateAllFilesFlag();
    this.testingLanguageOverride = Config.getStringFromConfig('testingLanguageOverride');
    this.isGitRepository = this.isInGitRepo();
    this.platform = process.platform;
    this.defaultBranch = Config.getStringFromConfig('defaultBranch')
  }

  /**
   * Get an boolean value from config (default to false, if the value is not exactly true, we also return false)
   */
  private static getBoolFromConfig(configProperty: string, defaultVal = false): boolean {
    const configVal = Config.getValueFromConfigFile(configProperty);
    return typeof configVal === 'boolean' ? configVal : defaultVal;
  }

  public async getVersion(): Promise<string> {
    if (this.versionCache !== this.undefinedVersion) {
      return this.versionCache;
    }
    const packageJson = require('../../package.json');
    const version = packageJson?.version;
    if (version) {
      this.versionCache = version;
      return this.versionCache;
    } else {
      await exitWithError('Unable to detect DeepUnit version, this should never happen.'); //should never happen but in case
      return '';
    }
  }

  private getFrameworkVersion(): string {
    let frameworkVersion = this.getPackageVersionIfInstalled(this.frontendFramework);
    if(frameworkVersion) {
      return frameworkVersion;
    } else {
      return '';
    }

  }

  private getLanguage(): string {
    if (this.testingLanguageOverride) {
      return this.testingLanguageOverride;
    }
    let fileContent = fs.readFileSync('package.json', 'utf8');
    if (!fileContent.includes('typescript')) {
      return 'javascript';
    }

    return 'typescript';
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
      if ('angular/common' in dependencies || 'angular/common' in devDependencies) {
        this.frontendFramework = 'angular';
        return;
      }
      if ('react' in dependencies || 'react' in devDependencies) {
        this.frontendFramework = 'react';
        return;
      }
    }
    this.frontendFramework = '';
  }

  private determineDevBuild() {
    if (fs.existsSync(devConfig) && !this.prodTesting) {
      this.isDevBuild = true;
    } else if (fs.existsSync(devConfig) && this.prodTesting) {
      console.log('DeepUnit is running in production testing mode');
    }
  }

  private getTestFramework(): TestingFrameworks {
    let jestConfigPath = 'jest.config.js';
    let karmaConfigPath = 'karma.conf.js';
    let packageJsonPath = 'package.json';
    let testingFramework = TestingFrameworks.unknown;
    if (fs.existsSync(jestConfigPath)) {
      testingFramework = TestingFrameworks.jest;
    } else if (fs.existsSync(karmaConfigPath)) {
      testingFramework = TestingFrameworks.jasmine;
    } else if (fs.existsSync(packageJsonPath)) {
      let fileContent = fs.readFileSync(packageJsonPath, 'utf8');
      if (fileContent.includes('jest')) {
        testingFramework = TestingFrameworks.jest;
      } else if (fileContent.includes('jasmine-core')) {
        testingFramework = TestingFrameworks.jasmine;
      }
    }

    return testingFramework;
  }

  private detectTestSuffix(): void {
    let testSuffix = Config.getStringFromConfig('testSuffix');
    if (!testSuffix) {
      testSuffix = 'test';
    }
    this.testSuffix = testSuffix;
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
          // TODO: we need to make this async but can't because it is within the constructor
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
  public static getStringFromConfig(configProperty: string, defaultValue?: string): string {
    const configVal = Config.getValueFromConfigFile(configProperty);
    if (configVal) {
      return configVal.toString();
    } else if(defaultValue) {
      return defaultValue
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
    await this.confirmJestExists();
    if (this.frontendFramework == 'react') {

      await this.confirmReactPackages();
    }
  }

  private async confirmJestExists() {
    // we overwrote the framework, ignore the checks
    if (this.testingLanguageOverride) {
      console.log('Using test language override of' + this.testingLanguageOverride);
      return;
    }

    let fileContent = fs.readFileSync('package.json', 'utf8');
    if (!fileContent.includes('jest')) {
      const wantsToUseJest = await getYesOrNoAnswer('Jest is not installed, would you like to install it? (it is required to generate tests)');
      if (!wantsToUseJest) {
        await exitWithError('Unable to generate tests without Jest');
      }
      // install jest
      installPackage('jest', true);
      console.log('Installing jest');

      // if typescript, then install requirements for those
      if (this.getLanguage() == 'typescript') {
        console.log('Typescript Detected: Installing typescript requirements for Jest');
        installPackage('ts-jest', true);
        installPackage('@types/jest', true);

        const jestConfig = "module.exports = {\n  preset: 'ts-jest',\n  testEnvironment: 'node',\n};";

        if (!fs.existsSync('jest.config.js')) {
          fs.writeFileSync('jest.config.js', jestConfig);
        } else {
          console.warn('Unable to create jest.config.js for typescript changes, it already exists. Ignoring...');
        }
      }
    }
  }

  private async confirmReactPackages() {



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

  private confirmRunningReactVersion18(): boolean {
    const reactVersion = this.getPackageVersionIfInstalled('react');
    const versionRegex = new RegExp(/([\d.]+)/);
    if (!reactVersion) {
      console.warn('React is a missing dependency, yet we assume you are using react. There is an issue, please check your config that you are not forcing it to be react.');
    } else {
      const versionNumbers = reactVersion.match(versionRegex);
      if (versionNumbers && versionNumbers[0] && versionNumbers[0].split('.') && !isNaN(+versionNumbers[0].split('.')[0])) {
        const number = +versionNumbers[0].split('.')[0];
        if (number >= 18) {
          console.warn(Color.yellow('We currently do not support react version 18 and above. You may continue although imports might not work right.'));
          return true;
        }
      } else {
        console.error('Unable to parse react version number.');
      }
    }
    return false;
  }

  public getPackageVersionIfInstalled(requiredPackaged: string): string | null {
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
  
  public async askForDefaultBranch() {
    if(!this.defaultBranch) {
      const branchName = await askQuestion('Please enter the name of your default branch. This is usually main, master or dev but could be anything.', 'master')
      this.defaultBranch = branchName
      Files.updateConfigFile('defaultBranch', branchName)
    }
  }
}

export const CONFIG = new Config();
