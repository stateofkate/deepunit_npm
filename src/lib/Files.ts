import { execSync } from 'child_process';
import * as fs from 'fs';
import path from 'path';
import { CONFIG } from '../main';
import { exitWithError, getFilesFlag, getGenerateAllFilesFlag } from './utils';
import * as glob from 'glob';

export class Files {
  public static getFilesToTest(): string[] {
    let filesToWriteTestsFor: string[] = [];
    // get files to filter with --f arg, returns things like src/* and **/*
    const filesToFilter: string[] | undefined = getFilesFlag();
    // check whether we have an --a flag, marking all
    const shouldGenerateAllFiles = getGenerateAllFilesFlag();

    const src = 'src';
    const workingDir = Files.existsSync(src) ? src + '/' : '';
    // if we want to find specific files or just generate all files
    if (filesToFilter) {
      console.log('Finding files within --file flag');
      filesToWriteTestsFor = glob.sync(filesToFilter, {});
    } else if (shouldGenerateAllFiles) {
      console.log('Finding all eligible files in working directory');
      filesToWriteTestsFor = glob.sync(`${workingDir}**`);
    } else {
      console.log('Finding all changed files in your repository');
      if (!CONFIG.isGitRepository) {
        exitWithError(`You are not in a git repository.`);
      } else {
        filesToWriteTestsFor = Files.getChangedFiles();
      }
    }

    const filteredFiles = Files.filterFiles(filesToWriteTestsFor);

    // if we didn't get any files, return error
    if (filteredFiles.length <= 0) {
      exitWithError(`No files to test were found. Check your config is set right or that you are using the --file flag correctly.`);
    }

    return filteredFiles;
  }

  public static getChangedFiles(): string[] {
    const gitRoot = execSync('git rev-parse --show-toplevel').toString().trim();
    const currentDir = process.cwd();
    const relativePath = currentDir.replace(gitRoot, '').replace(/^\//, ''); // Remove leading /

    let changedFiles: string[] = [];
    let getChangedFileCmds = [`git -C ${gitRoot} diff --name-only`, `git -C ${gitRoot} diff --name-only --staged`, `git -C ${gitRoot} diff --name-only HEAD~1`];

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

  public static filterExtensions(files: string[]): string[] {
    let filteredFiles: string[] = [];
    for (const file of files) {
      // TODO: make this a custom regex they can choose from
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

  public static getDiff(files: string[]): string {
    const diffCmd = `git diff --unified=0 HEAD~1 HEAD -- ${files.join(' ')}`;
    return execSync(diffCmd)
      .toString()
      .split('\n')
      .filter((line) => !line.trim().startsWith('-'))
      .join('\n');
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
  public static filterFiles(files: string[]): string[] {
    const filesWithValidExtensions = this.filterExtensions(files);
    const filteredFiles: string[] = [];

    for (const file of filesWithValidExtensions) {
      if (!CONFIG.ignoredDirectories.some((ignoreDir) => Files.isParentAncestorOfChild(ignoreDir, file)) && !CONFIG.ignoredFiles.some((ignoreFile) => file == ignoreFile)) {
        filteredFiles.push(file);
      }
    }
    return filteredFiles;
  }

  public static isParentAncestorOfChild(parent: string, child: string) {
    const rel = path.relative(parent, child);
    return !rel.startsWith('../') && rel !== '..';
  }

  public static writeTestsToFiles(tests: Record<string, string>): string[] {
    let testPaths: string[] = [];
    for (const [testFilePath, testCode] of Object.entries(tests)) {
      try {
        if (!fs.existsSync(testFilePath)) {
          fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
        }
        Files.writeFileSync(testFilePath, testCode);
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

  public static groupFilesByDirectory(changedFiles: string[]): Record<string, string[]> {
    const filesByDirectory: Record<string, string[]> = {};

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
      '.prettierrc',
      '.prettierrc.json',
      '.prettierrc.yml',
      '.prettierrc.yaml',
      '.prettierrc.js',
      '.prettierrc.ts',
      'prettier.config.js',
      'prettier.config.ts',
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
    console.error(`We could not find your prettier config file, if you have one please email support@deepunit.ai so we can add support for your configuration`);
    return undefined;
  }

  public static setup() {
    const configPath = 'deepunit.config.json';
    if (!fs.existsSync(configPath)) {
      const configFileContent =
        '{\n' + '  "ignoredDirectories": ["node_modules"],\n' + '  "ignoredFiles": [],\n' + '  "includeFailingTests": false,\n' + '  "testSuffix": "test"\n' + '}\n';
      fs.writeFileSync(configPath, configFileContent);
    }
    const packagePath = 'package.json';
    if (fs.existsSync(packagePath)) {
      // Read package.json
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      packageJson.scripts = packageJson.scripts || {};

      // only add the script if it doesn't exist
      if (packageJson.scripts.deepunit) {
        return;
      }

      packageJson.scripts.deepunit = 'deepunit';

      // Write package.json
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    } else {
      console.log("No package.json found! That's gonna be a problem. DeepUnit probably will not be successful at running.");
      console.log(`Current working directory is ${process.cwd()}`);
    }
  }
}
