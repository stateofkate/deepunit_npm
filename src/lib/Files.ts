import { execSync } from 'child_process';
import * as fs from 'fs';
import path from 'path';
import { CONFIG } from './Config';
import {
  exitWithError,
  getAbsolutePathsFlag,
  getBugFileFlag,
  getBugFlag,
  getForceFilter,
  getFilesFlag,
  getGenerateAllFilesFlag,
  getPatternFlag,
  setupYargs,
  getYesOrNoAnswer, askQuestion, getTargetBranchFlagFlag
} from './utils';
import * as glob from 'glob';
import { Color } from './Printer';

export class Files {
  public static hasFetched = false;
  public static async getFilesToTest(): Promise<{ filesFlagReturn: { readyFilesToTest: string[]; flagType: string } }> {
    let filesToWriteTestsFor: string[] = [];

    const filesToDebugAndWriteTests: string[] | undefined = getBugFileFlag();
    // get files to filter with --f arg, returning direct paths
    let filesToFilter: string[] | undefined = getFilesFlag();
    if (getAbsolutePathsFlag() && filesToFilter) {
      filesToFilter = await Files.mapGitPathsToCurrentDirectory(filesToFilter);
    }


    const filesToDebug: string [] | undefined = getBugFlag();
    // get file patterns, returns things like src/* and **/*
    const patternToFilter: string[] | undefined = getPatternFlag();
    // check whether we have an --a flag, marking all
    const shouldGenerateAllFiles = getGenerateAllFilesFlag();

    if (getForceFilter()) {
      console.log('Using force filter to apply ignore filter to all files.');
    }

    let flagType = '';

    const src = 'src';
    const workingDir = Files.existsSync(src) ? src + '/' : '';
    // if we want to find specific files or just generate all files
    if (filesToFilter) {
      console.log('Finding files within --file flag');
      const missingFiles = filesToFilter.filter((filePath) => {
        if (!Files.existsSync(filePath)) {
          flagType = 'fileFlag';
          return true;
        }
        flagType = 'fileFlag';
        return false;
      });

      if (missingFiles.length > 0) {
        await exitWithError(`${missingFiles.join(', ')} file(s) could not be found, only include valid file paths. Unable to continue, exiting.`);
      }
      filesToWriteTestsFor = filesToFilter;
    } else if (patternToFilter) {
      console.log('Finding files that match the --pattern flag');
      flagType = 'patternFlag';
      filesToWriteTestsFor = glob.sync(patternToFilter, {});
    } else if (shouldGenerateAllFiles) {
      console.log('Finding all eligible files in working directory');
      flagType = 'allFlag';
      filesToWriteTestsFor = glob.sync(`${workingDir}**`);
    } else if (filesToDebug) {
      console.log('Finding files to test for bugs');
      flagType = 'bugFlag';
      filesToWriteTestsFor = glob.sync(filesToDebug, {});
    } else if (filesToDebugAndWriteTests) {
      console.log('Finding files to test for bugs and then write unit tests for');
      flagType = 'bugFileFlag';
      filesToWriteTestsFor = glob.sync(filesToDebugAndWriteTests,{});
    } else {
      console.log('Finding all changed files in your repository');
      if (!CONFIG.isGitRepository) {
        await exitWithError(`You are not in a git repository.\nFor complete documentation visit https://deepunit.ai/docs`);
      } else {
        filesToWriteTestsFor = Files.getChangedFiles();
      }
    }

    const { filteredFiles, ignoredFiles } = Files.filterFiles(filesToWriteTestsFor);

    let readyFilesToTest: string[] = [];
    // we don't want to filter files if they have specified the exact files they want.
    if ((filesToFilter || filesToDebug) && !getForceFilter()) {
      readyFilesToTest = filesToWriteTestsFor;
    } else {
      // we have filtered out some files, lets notify the user what we removed
      readyFilesToTest = filteredFiles;
      if (ignoredFiles.length > 0) {
        console.log(`Ignoring ${ignoredFiles.length} files: ${ignoredFiles.join(', ')}`);
      }
    }

    // if we didn't get any files, return error
    if (readyFilesToTest.length <= 0) {
      await exitWithError(
        Color.yellow('Run deepunit with flag -h for more information.') +
          '\nNo files to test were found. Check your config is set right or that you are using the --file flag correctly.',
      );
    }

    return {
      filesFlagReturn: {
        readyFilesToTest,
        flagType,
      },
    };
  }

  public static getChangedFiles(): string[] {
    const gitRoot = execSync('git rev-parse --show-toplevel').toString().trim();
    const currentDir = process.cwd();
    const relativePath = currentDir.replace(gitRoot, '').replace(/^\//, ''); // Remove leading /

    let changedFiles: string[] = [];
    let getChangedFileCmds = [`git -C ${gitRoot} diff --name-only`, `git -C ${gitRoot} diff --name-only --staged`];

    while (getChangedFileCmds.length > 0) {
      const currentCommand = getChangedFileCmds.pop() + ` -- ${relativePath ? relativePath + '/' : ''}`;
      const output = execSync(currentCommand).toString();
      changedFiles = output.split('\n').filter(Boolean); // filter out empty strings
      if (changedFiles.length > 0) {
        break;
      }
    }

    if (relativePath) {
      return changedFiles.map((file) => {
        return file.replace(`${relativePath}/`, '');
      });
    } else {
      return changedFiles;
    }
  }

  public static async mapGitPathsToCurrentDirectory(relativePaths: string[]): Promise<string[]> {
    try {
      const rootGitDirectory = execSync('git rev-parse --show-toplevel').toString().trim();
      const currentWorkingDirectory = process.cwd();

      // Map each relative path to an absolute path based on the current working directory
      return relativePaths.map((relativePath) => {
        const absolutePathFromGitRoot = path.join(rootGitDirectory, relativePath);

        return path.relative(currentWorkingDirectory, absolutePathFromGitRoot);
      });
    } catch (error) {
      console.error('Error occurred, unable to map git paths to relative paths:', error);
      return relativePaths;
    }
  }

  public static filterExtensions(files: string[]): string[] {
    let filteredFiles: string[] = [];
    for (const file of files) {
      const excludedSuffixes = [
        '.test.ts',
        '.test.tsx',
        '.test.js',
        '.spec.ts',
        '.spec.tsx',
        '.spec.js',
        '.module.ts',
        '.module.tsx',
        '.module.js',
        '.consts.ts',
        '.consts.tsx',
        '.d.ts',
      ];

      const includedExtensions = ['.ts', '.js', '.tsx'];

      if (includedExtensions.some((ext) => file.endsWith(ext)) && !excludedSuffixes.some((suffix) => file.endsWith(suffix))) {
        filteredFiles.push(file);
      }
    }
    return filteredFiles;
  }

  public static async getDiff(files: string[], attempt = 0): Promise<string> {
    const remoteName = await this.askForRemote()
    if(this.hasFetched) { //Its important that we not fetch multiple times as if the remote branch receives new commits in between some diffs could be outdated while others aren't, which sounds confusing
      const fetchCommand = `git fetch ${remoteName}`
      const permission = await getYesOrNoAnswer(`Can DeepUnit fetch your remote? The command we will run is "${fetchCommand}"`)
  
      if (permission) {
        execSync(fetchCommand); // Ensure you handle errors here
        this.hasFetched = true;
      } else {
        console.error("DeepUnit was unable to get user permission to fetch remote. If the default branch is outdated we might have an outdated diff.")
      }
    }
    const targetBranch: string = getTargetBranchFlagFlag()
    const diffCmd = `git diff origin/${targetBranch}..HEAD -- ${files.join(' ')}`;
    try {
      return execSync(diffCmd)
        .toString()
        .split('\n')
        .filter((line) => !line.trim().startsWith('-'))
        .join('\n');
    } catch (error) {
      if (error.message.includes('bad revision') && attempt < 2) {
        await Files.setRemoteHead(remoteName); // Call the function to set remote HEAD
        return this.getDiff(files, attempt+1); // Retry getting the diff
      } else {
        console.log('Attempt to get diffs count: ' + attempt)
        throw error; // Rethrow other errors
      }
    }
  }
  /**
   * Retrieves a list of Git remotes.
   * @returns {string[]} List of Git remotes.
   */
  public static getGitRemotes(): string[] {
    const remotes = execSync('git remote').toString().trim();
    return remotes ? remotes.split('\n') : [];
  }
  /**
   * Asks the user to select a Git remote.
   * @param {string} branch - The branch name for context in the prompt.
   * @returns {Promise<string>} The selected remote.
   */
  public static async askForRemote(): Promise<string> {
    const remotes = this.getGitRemotes();
    if (remotes.length === 0) {
      console.log('No Git remotes found.');
      return '';
    }
    if(remotes.length === 1) {
      return remotes[0].trim();
    }
    
    const prompt = `What is the name of the remote that we should compare your default branch ${CONFIG.defaultBranch} to? Your local repository is configured with these remotes: ${remotes.join(', ')} `;
    return askQuestion(prompt, 'origin');
  }
  public static async setRemoteHead(remoteName: string) {
    
    const branchName = CONFIG.defaultBranch;
    
    const setHeadCommand = `git remote set-head ${remoteName} ${branchName}`;
    const permission = getYesOrNoAnswer(`We need to set your local repositories head to track remote. The command we will run is "${setHeadCommand}"`)
    try {
      execSync(setHeadCommand);
      console.log(`\nRemote HEAD set to ${branchName}`);
    } catch (error) {
      console.error(`Error setting remote HEAD: ${error.message}`);
      throw error;
    }
  }
  public static getFileContent(file: string | null): string {
    if (file === null) {
      return '';
    }
    try {
      const content = fs.readFileSync(file, 'utf-8');
      return content;
    } catch (error) {
      if (error instanceof Error) {
        // @ts-ignore
        if (error.code === 'ENOENT') {
          console.warn(`Warning: File ${file} not found`);
        } else {
          console.error(error);
          console.error(`An error occurred while trying to read ${file}: ${error}`);
        }
      }
      return '';
    }
  }
  //test
  public static getExistingTestContent(file: string): string | null {
    let testContent: string = '';
    try {
      testContent = fs.readFileSync(file, 'utf-8');
    } catch (error) {
      console.error(error);
      console.error('Error reading the file, contact support@depunit.ai if this causes issues.');
      return null;
    }
    return testContent;
  }

  public static createFile(filename: string): void {
    // Create a new file
    Files.writeFileSync(filename, '');

    if (CONFIG.isGitRepository) {
      // Run git add on the file
      try {
        execSync(`git add ${filename}`);
      } catch (error) {
        console.error(filename);
        console.error(error);
        console.error(`Error running git add: `);
      }
    }
  }

  /**
   * Filter out files that are within certain directories or match certain filenames.
   *
   *   Parameters:
   *   files (list): List of file paths.
   *
   *   Returns:
   *   list: List of file paths that are not within the ignoreDirectories and do not match filenames in ignoredFiles.
   */
  public static filterFiles(files: string[]): { filteredFiles: string[]; ignoredFiles: string[] } {
    const filesWithValidExtensions = this.filterExtensions(files);
    const filteredFiles: string[] = [];
    const ignoredFiles: string[] = [];

    for (const file of filesWithValidExtensions) {
      if (!CONFIG.ignoredDirectories.some((ignoreDir) => Files.isParentAncestorOfChild(ignoreDir, file)) && !CONFIG.ignoredFiles.some((ignoreFile) => file == ignoreFile)) {
        filteredFiles.push(file);
      } else {
        ignoredFiles;
      }
    }
    return { filteredFiles, ignoredFiles };
  }

  public static isParentAncestorOfChild(parent: string, child: string) {
    const rel = path.relative(parent, child);
    return !rel.startsWith('../') && rel !== '..';
  }

  public static writeTestsToFiles(tests: { [key: string]: string }, filePathChunk: string): string[] {
    let testPaths: string[] = [];
    for (const [testFilePath, testCode] of Object.entries(tests)) {
      try {
        if (!fs.existsSync(testFilePath)) {
          fs.mkdirSync(path.dirname(filePathChunk + testFilePath), { recursive: true });
        }
        Files.writeFileSync(filePathChunk + testFilePath, testCode);

        testPaths.push(testFilePath);
      } catch (e) {
        console.error({ testCode, message: 'Error while saving', e, testFilePath });
      }
    }
    return testPaths;
  }

  public static writeFileSync(file: string, data: string, options?: any) {
    try {
      fs.writeFileSync(file, data, options);
    } catch (e) {
      console.error({ data, options });
      console.error(`Unable to write file: ${file}`);
    }
  }

  public static deleteTempFiles(tempTestPaths: string[]) {
    tempTestPaths.forEach((filePath) => {
      try {
        // delete the file
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Error deleting file: ${filePath}`);
        console.error(err);
      }
    });
  }

  public static groupFilesByDirectory(changedFiles: string[]): { [key:string]:string[] } {
    const filesByDirectory: { [key: string]: string[] } = {};

    for (const file of changedFiles) {
      const directory = path.dirname(file);

      if (!filesByDirectory[directory]) {
        filesByDirectory[directory] = [];
      }

      filesByDirectory[directory].push(file);
    }

    return filesByDirectory;
  }

  public static existsSync(path: fs.PathLike) {
    return fs.existsSync(path);
  }

  public static readFileSync(path: fs.PathLike) {
    return fs.readFileSync(path);
  }

  public static readJsonFile(path: fs.PathLike): Object | undefined {
    if (Files.existsSync(path)) {
      const fileContent = Files.readFileSync(path).toString();
      if (fileContent) {
        return JSON.parse(fileContent);
      }
    }
    return undefined;
  }

  static getGitRootDirectory(): string | undefined {
    try {
      const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
      return gitRoot;
    } catch (error) {
      console.error('Error while fetching Git root directory:', error);
      return undefined;
    }
  }

  static getPrettierConfig(): Object | undefined {
    //fo now we only support .prettierrc because we ould need to parse all these other filetypes. We will wait for customers to request this.
    //Prettier is available in so many places... this is close enough until someone complains we dont support their config: https://prettier.io/docs/en/configuration.html
    const prettierConfigFiles = [
      // 'package.json', // You'll need to manually check if package.json contains a "prettier" field
      '.prettierrc.json',
    ];

    let directoriesToCheck = [process.cwd()];
    if (CONFIG.isGitRepository) {
      const rootDirectory = this.getGitRootDirectory();
      if (rootDirectory) {
        directoriesToCheck.push(rootDirectory);
      }
    }

    for (const dir of directoriesToCheck) {
      for (const configFile of prettierConfigFiles) {
        const fullPath = path.join(dir, configFile);
        if (fs.existsSync(fullPath)) {
          if (configFile != '.prettierrc') {
            console.error(`We currently do not support ${configFile}, please email support@deepunit.ai so we can add support for your configuration`);
          } else {
            const prettierFileContent = Files.readJsonFile(fullPath);
            if (prettierFileContent) {
              return prettierFileContent;
            }
          }
          /* This code will work for other filetypes once we have a parser setup
                   if (configFile === 'package.json') {
            const packageJson = this.readJsonFile(fullPath);
            if (packageJson && 'prettier' in packageJson && packageJson.prettier) {
              return packageJson.prettier;
            }
          } else {
            const prettierFileContent = Files.readJsonFile(fullPath);
            if (prettierFileContent) {
              return prettierFileContent;
            }
          }*/
        }
      }
    }
    return undefined;
  }
  
  public static updateConfigFile(propertyName: string, propertyValue: any) {
    const configPath = 'deepunit.config.json';
    
    // Check if the config file exists
    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found at ${configPath}, creating it now`);
      this.setup();
    }
    
    // Read the existing configuration
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Update the specified property
    config[propertyName] = propertyValue;
    
    // Write the updated configuration back to the file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Updated ${propertyName} in ${configPath}`);
  }

  public static setup() {
    const configPath = 'deepunit.config.json';
    if (!fs.existsSync(configPath)) {
      const configFileContent =
        '{\n' +
        '  "ignoredDirectories": ["node_modules"],\n' +
        '  "ignoredFiles": [],\n' +
        '  "includeFailingTests": true,\n' +
        '  "testSuffix": "test"\n' +
        '  "defaultBranch": "master"\n' +
        '}\n';
      fs.writeFileSync(configPath, configFileContent);
    }
    const packagePath = 'package.json';
    if (fs.existsSync(packagePath)) {
      // Read package.json
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      // only add the script if it doesn't exist
      if (packageJson.scripts?.deepunit) {
        return;
      }
      packageJson.scripts = packageJson.scripts || {};
      packageJson.scripts.deepunit = 'deepunit';

      // Write package.json
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    } else {
      console.log("No package.json found! That's gonna be a problem. DeepUnit probably will not be successful at running.");
      console.log(`Current working directory is ${process.cwd()}`);
    }
  }
}
