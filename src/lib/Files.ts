import { execSync } from 'child_process';
import fs, {FileSystem, PathLike} from "./vsfs";
//import fs from 'fs';
import path from 'path';
import Config, {checkAndCreateConfig} from './Config';
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
import { Color } from './Color';
import {check} from "yargs";

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
    const workingDir = fs.existsSync(src) ? src + '/' : '';
    // if we want to find specific files or just generate all files
    if (filesToFilter) {
      console.log('Finding files within --file flag');
      const missingFiles = filesToFilter.filter((filePath) => {
        if (!fs.existsSync(filePath)) {
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
      const CONFIG = new Config();
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
  public static hasUncommittedChanges(files: string[], targetBranch: string, remoteName: string) {
    try {
      const status = execSync(`git status ${remoteName}/${targetBranch} --porcelain -- ${files.join(' ')}`).toString();
      return status !== '';
    } catch (error) {
      console.error('Error checking for uncommitted changes:', error);
      return false;
    }
  }

  public static async getDiff(files: string[], attempt = 0): Promise<string[]> {

    /*
    scenarios:
    1. We are in github/gitlab action and want to get diffs of the submitted pull request commit vs the target branch commit, i.e. committed changes against committed changes
    2. We are in VS code / npm package and want to get diffs of the working file vs the target branch commit, i.e. committed changes of current working file, as well as staged and unstaged changes

    Some notes on git commands:
    1. git diff (without any arguments): Shows the differences between the working directory and the index (staging area). This means it only shows unstaged changes.
  	2. git diff --staged or git diff --cached: Shows the differences between the index (staging area) and the last commit (HEAD). This means it only shows staged changes.
  	3. git diff HEAD: Shows the differences between the working directory (both staged and unstaged changes) and the last commit (HEAD). This is why you're seeing both staged and unstaged changes with this command.
  	4. git diff origin/dev..HEAD: Compares the state of the repository at origin/dev with HEAD. This command only shows changes that have been committed between these two points. Unstaged and staged (but not yet committed) changes in your working directory are not included in this comparison.
     */

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
    const targetBranchFlag: string = getTargetBranchFlagFlag()
    const targetBranch = targetBranchFlag ? targetBranchFlag : new Config().defaultBranch;
    let diffCmd = []
    if(targetBranchFlag) { //handles things for CICD pipelines
      //github/gitlab action
      diffCmd.push(`git diff ${remoteName}/${targetBranch}..HEAD -U0 -- ${files.join(' ')}`);
    } else {
      // we are in npm package/VS code
      // this shows committed changes between this branch vs target branch:
      diffCmd.push(`git diff ${remoteName}/${targetBranch}..HEAD -U0 -- ${files.join(' ')}`);
      // this shows unstaged and staged changes
      diffCmd.push(`git diff HEAD -U0 -- ${files.join(' ')}`)
    }
    try {
      let diff: string[] = [];
      for(const diffCommand of diffCmd) {
        const diffString = execSync(diffCommand).toString()
        if(diffString.length>0){
          diff.push(diffString)
        }
      }

      return diff.length > 0 ? diff : undefined
    } catch (error) {
      if (error.message.includes('bad revision') && attempt < 1) {
        await Files.setRemoteHead(remoteName); // Call the function to set remote HEAD
        return this.getDiff(files, attempt+1); // Retry getting the diff
      } else {
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

    const prompt = `What is the name of the remote that we should compare your default branch ${new Config().defaultBranch} to? Your local repository is configured with these remotes: ${remotes.join(', ')} `;
    return askQuestion(prompt, 'origin');
  }
  public static async setRemoteHead(remoteName: string) {
    const CONFIG = new Config();
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
    const CONFIG = new Config();
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
      const CONFIG = new Config();
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

  public static readJsonFile(path: PathLike): Object | undefined {
    if (fs.existsSync(path)) {
      const fileContent = fs.readFileSync(path).toString();
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
    const CONFIG = new Config();
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

  public static async updateConfigFile(propertyName: string, propertyValue: any) {
    const configPath = 'deepunit.config.json';
  
    // Check if the config file exists
    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found at ${configPath}, creating it now`);
      await checkAndCreateConfig();
    }
  
    // Read the existing configuration
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
    // Update the specified property
    config[propertyName] = propertyValue;
  
    // Write the updated configuration back to the file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Updated ${propertyName} in ${configPath}`);
  }
}
