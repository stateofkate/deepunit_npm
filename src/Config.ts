import path from 'path';
import { debug, rootDir } from './main';
import * as fs from 'fs';
import ts from 'typescript';

// HARDCODED CONFIG VALUES
const configFilePath = 'deepunit.config.json';
const extraConfigFilePath = 'deepunit.extra.config.json';
const prodBase = 'https://dumper.adaptable.app';
const localHostBase = 'http://localhost:8080';

/** Automatically Detected Project configs
 * These configs are first pulled from deepunit.config.json, if absent we will try to use the detect*() Function to autodetect
 */
export class Config {
  workspaceDir: string = '';
  frontendFramework: string = '';
  testExtension: string = '';
  testingFramework: string = '';
  scriptTarget: string = '';
  typescriptExtension: string = '';
  prodBase: string = prodBase;
  generateApiPath: string = '';
  fixErrorApiPath: string = '';
  testApiPath: string = '';
  password: string = 'nonerequired';

  static async init(): Promise<Config> {
    const config = new Config();

    await config.detectWorkspaceDir();
    await config.detectProjectType();
    await config.detectTestFramework();
    await config.detectTsconfigTarget();
    await config.detectTypescriptExtension();

    config.getUrls();

    config.password = Config.grabFromConfig('password') || 'nonerequired';

    return config;
  }

  // Find the where the package.json file is located
  ///If your package.json is not in the root directory set this to the directory it is located in.
  // The autodetect Function will reset it to the root directory if package.json is not found in the directory specified
  detectWorkspaceDir(): void {
    // go to the current working directory
    process.chdir(rootDir);
    // Check if the configuration file exists
    let configWorkspaceDir = Config.grabFromConfig('workspaceDir');
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
      console.error(
        'Please resolve the path and update the workspaceDir in deepunit.config.json',
      );
      process.exit(1);
    }
  }

  private detectProjectType(): void {
    process.chdir(rootDir);
    const configValue = Config.grabFromConfig('frontendFramework');
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
      if (
        'angular/common' in dependencies ||
        'angular/common' in devDependencies
      ) {
        this.frontendFramework = 'angular';
        return;
      }
    }
    // Unable to find the framework
    debug(
      'WARNING: Unable to detect frontend framework, typescript extension',
      true,
    );
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
      this.testingFramework = 'jest';
      this.testExtension = '.test.ts';
    } else if (fs.existsSync(karmaConfigPath)) {
      this.testingFramework = 'jasmine';
      this.testExtension = '.spec.ts';
    } else if (fs.existsSync(packageJsonPath)) {
      let fileContent = fs.readFileSync(packageJsonPath, 'utf8');
      if (fileContent.includes('jest')) {
        this.testingFramework = 'jest';
        this.testExtension = '.test.ts';
      } else if (fileContent.includes('jasmine-core')) {
        this.testingFramework = 'jasmine';
        this.testExtension = '.spec.ts';
      }
    }
  }
  private detectTsconfigTarget(): void {
    let tsconfigPath: string | null = path.join(
      this.workspaceDir,
      'ts.config.json',
    );

    while (tsconfigPath) {
      if (fs.existsSync(tsconfigPath)) {
        let contents: string = fs.readFileSync(tsconfigPath, 'utf8');
        try {
          let tsconfigJson = ts.parseConfigFileTextToJson('', contents);
          this.scriptTarget = tsconfigJson.config?.compilerOptions?.target
            ? tsconfigJson.config?.compilerOptions?.target
            : undefined;
          if (tsconfigPath != null) {
            // @ts-ignore
            tsconfigPath = tsconfigJson.config?.extends
              ? path.join(
                  path.dirname(tsconfigPath),
                  tsconfigJson.config?.extends,
                )
              : null;
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

  // TODO: Should we support both tsx and ts?
  private detectTypescriptExtension(): void {
    const configTypescript = Config.grabFromConfig('typescriptExtension');
    if (configTypescript) {
      this.typescriptExtension = configTypescript;
    } else if (this.frontendFramework === 'react') {
      this.typescriptExtension = '.tsx';
    } else if (this.frontendFramework === 'angular') {
      this.typescriptExtension = '.ts';
    } else {
      this.typescriptExtension = '.ts';
    }
  }

  private getUrls(): void {
    const doProd = Config.grabFromConfig('doProd');
    const host = doProd ? prodBase : localHostBase;
    this.generateApiPath = `${host}/generate-test/new`;
    this.fixErrorApiPath = `${host}/generate-test/fix-error`;
    this.testApiPath = `${host}/generate-test/test-code`;
  }

  public static grabFromConfig(configProperty: string): string | null {
    if (fs.existsSync(extraConfigFilePath)) {
      let config = JSON.parse(fs.readFileSync(extraConfigFilePath, 'utf8'));

      // Check if the 'repoPath' property exists in the configuration
      if (configProperty in config) {
        let shouldSkip: boolean = false;
        if ('skipExtraConfig' in config) {
          let skipExtraConfig: boolean = config['skipExtraConfig'];
          if (skipExtraConfig) {
            shouldSkip = skipExtraConfig;
          }
        }
        if (!shouldSkip) {
          let configValue = config[configProperty];
          return configValue;
        }
      }
    }
    if (fs.existsSync(configFilePath)) {
      let config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

      // Check if the 'repoPath' property exists in the configuration
      if (configProperty in config) {
        let configValue = config[configProperty];
        return configValue;
      }
    }
    return null;
  }
}
