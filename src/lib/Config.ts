import path from 'path';
import * as fs from 'fs';
import ts from 'typescript';
import { TestingFrameworks } from '../main.consts';
import { exitWithError } from './utils';

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
  testExtension: string = '';
  testingFramework: TestingFrameworks = TestingFrameworks.unknown;
  scriptTarget: string = '';
  typescriptExtension: string = '';
  password: string = 'nonerequired';
  doProd: boolean;
  apiHost: string = '';
  version: string;
  ignoredDirectories: string[] = [];
  ignoredFiles: string[] = [];
  includeFailingTests: boolean = true;
  generateChangedFilesOnly = true;
  isDevBuild: boolean = false;
  prodTesting: boolean = false;

  constructor() {
    this.detectProjectType();
    this.detectTsconfigTarget();
    this.detectTestFramework();
    this.prodTesting = Config.getBoolFromConfig('prodTesting');
    this.determineDevBuild();

    this.version = this.getVersion();
    this.typescriptExtension = Config.getStringFromConfig('typescriptExtension') ?? '.ts';
    this.password = Config.getStringFromConfig('password') || 'nonerequired';
    this.doProd = Config.getBoolFromConfig('doProd', true);
    this.ignoredDirectories = Config.getArrayFromConfig('ignoredDirectories');
    this.ignoredFiles = Config.getArrayFromConfig('ignoredFiles');
    this.apiHost = this.doProd ? prodBase : localHostBase;
    this.includeFailingTests = Config.getBoolFromConfig('includeFailingTests', true);
    this.generateChangedFilesOnly = Config.getBoolFromConfig('generateChangedFilesOnly', true);
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
    this.frontendFramework = 'unknown';
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
    let tsconfigPath: string = 'tsconfig.json';

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
          console.error(error);
          exitWithError('Unable to read the tsconfig');
        }
      } else {
        console.error('Error: unable to find tsconfig at ' + tsconfigPath);
        exitWithError('The current working directory is ' + process.cwd());
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
