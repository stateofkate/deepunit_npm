import { execSync } from 'child_process';
import * as fs from 'fs';
import path from 'path';
import { CONFIG, rootDir } from './Config';
import { exitWithError } from './utils';

export class Files {
  public static getChangedFiles(): string[] {
    const gitRoot = execSync('git rev-parse --show-toplevel').toString().trim();
    const currentDir = process.cwd();
    const relativePath = currentDir.replace(gitRoot, '').replace(/^\//, ''); // Remove leading /
    const changedFilesCmd = `git -C ${gitRoot} diff --name-only HEAD~1 HEAD -- ${relativePath ? relativePath + '/' : ''}`;
    const output = execSync(changedFilesCmd).toString();
    console.log('output');
    console.log(output);
    const files = output.split('\n').filter(Boolean); // filter out empty strings
    //if we are not in the root of the git repo we must truncate the path leading to the working directory

    const filteredFiles = this.filterExtensions(files);
    const filesWithCorrectedPaths = this.findPathFromCurrentDirectory(filteredFiles);
    console.log(filesWithCorrectedPaths);
    return filesWithCorrectedPaths;
  }
  public static findPathFromCurrentDirectory(files: string[]): string[] {
    const currentDir = process.cwd();
    const gitRoot = execSync('git rev-parse --show-toplevel').toString().trim();
    const relativePath = currentDir.replace(gitRoot, '').replace(/^\//, ''); // Remove leading /

    return files.map((file) => {
      return file.replace(`${relativePath}/`, '');
    });
  }

  public static filterExtensions(files: string[]): string[] {
    let filteredFiles: string[] = [];
    for (const file of files) {
      if (
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx') &&
        !file.endsWith('.test.js') &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.spec.js') &&
        !file.endsWith('.consts.ts') &&
        !file.endsWith('.d.ts') &&
        !file.endsWith('.module.ts') &&
        !file.endsWith('.module.js')
      ) {
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

  public static getExistingTestContent(file: string): string {
    let testContent: string = '';
    try {
      testContent = fs.readFileSync(file, 'utf-8');
    } catch (error) {
      if (error instanceof Error) {
        exitWithError('unable to read file ' + file);
      }
    }
    return testContent;
  }

  public static createFile(filename: string): void {
    // Create a new file
    Files.writeFileSync(filename, '');

    // Run git add on the file
    try {
      execSync(`git add ${filename}`);
    } catch (error) {
      console.error(filename);
      console.error(error);
      console.error(`Error running git add: `);
    }
  }

  public static findFiles(extensions: string[], ignoreExtensions: string[]): string[] {
    /**
      Find all files in all nested directories within workspaceDir with the given extensions and ignore files with the given ignoreExtensions.
  
          Parameters:
      extensions (list): List of extensions to match.
      ignoreExtensions (list): List of extensions to ignore.
  
          Returns:
      list: List of full paths to files that match the given extensions and do not match the ignoreExtensions.
      */
    const matches: string[] = [];
    const walkDir = CONFIG.workspaceDir || 'src'; // replace with actual workspaceDir if needed

    function walk(directory: string) {
      const files = fs.readdirSync(directory);

      for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (Files.filterExtensions([file])) {
          matches.push(fullPath);
        }
      }
    }

    walk(walkDir);
    return matches;
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

    const combinedIgnoredDirs = CONFIG.ignoredDirectories.map((dir) => path.join(CONFIG.workspaceDir, dir));

    const combinedIgnoredFiles = CONFIG.ignoredFiles.map((file) => path.join(CONFIG.workspaceDir, file));

    for (const file of filesWithValidExtensions) {
      if (!combinedIgnoredDirs.some((ignoreDir) => Files.isParentAncestorOfChild(ignoreDir, file)) && !combinedIgnoredFiles.some((ignoreFile) => file == ignoreFile)) {
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

  public static tsAndHtmlFromFile(file: string, filesInDirectory: string[]): [string | null, string | null, string | null] {
    const baseFile = path.basename(file, path.extname(file));
    const extension = path.extname(file);
    let correspondingFile: string | null = null;

    if (extension === CONFIG.typescriptExtension) {
      correspondingFile = `${baseFile}.html`;
    } else if (extension === '.html') {
      correspondingFile = `${baseFile}${CONFIG.typescriptExtension}`;
    }

    let htmlFile: string | null = null;
    let tsFile: string | null = null;

    if (correspondingFile && filesInDirectory.includes(correspondingFile)) {
      if (extension === CONFIG.typescriptExtension) {
        tsFile = file;
        htmlFile = correspondingFile;
      } else {
        tsFile = correspondingFile;
        htmlFile = file;
      }
    } else {
      if (extension === CONFIG.typescriptExtension) {
        tsFile = file;
      } else {
        htmlFile = file;
      }
    }

    return [tsFile, htmlFile, correspondingFile];
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

  public static getPrettierConfig(): Object | undefined {
    const prettierDefaultFilePath = '.prettierrc';
    process.chdir(rootDir);

    const prettierFileContent = Files.readJsonFile(prettierDefaultFilePath);
    if (prettierFileContent) {
      return prettierFileContent;
    }

    if (CONFIG.workspaceDir) {
      const scopedPrettierFilePath = path.join(CONFIG.workspaceDir, prettierDefaultFilePath);
      const scopedFileContent = Files.readJsonFile(scopedPrettierFilePath);
      if (scopedFileContent) {
        return scopedFileContent;
      }
    }

    return undefined;
  }
}
