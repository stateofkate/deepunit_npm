import { execSync } from 'child_process';
import * as fs from 'fs';
import path from 'path';
import { CONFIG } from './Config';

export class Files {
  public static getChangedFiles(): string[] {
    const changedFilesCmd = 'git diff --name-only HEAD~1 HEAD';
    const output = execSync(changedFilesCmd).toString();
    return output.split('\n').filter(Boolean);
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
        console.error('Had an error in reading the file, woopsies');
        console.error(file);
        console.error(error);
        console.log('Need help? Email justin@deepunit.ai');
        process.exit(1);
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
        } else if (extensions.some((ext) => file.endsWith(ext)) && !ignoreExtensions.some((ext) => file.endsWith(ext))) {
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
    const filteredFiles: string[] = [];

    const combinedIgnoredDirs = CONFIG.ignoredDirectories.map((dir) => path.join(CONFIG.workspaceDir, dir));

    const combinedIgnoredFiles = CONFIG.ignoredFiles.map((file) => path.join(CONFIG.workspaceDir, file));

    for (const file of files) {
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
        Files.stashAndSave(testFilePath, testCode);
        testPaths.push(testFilePath);
      } catch (e) {
        console.error({ testCode, message: 'Error while saving', e, testFilePath });
      }
    }
    return testPaths;
  }

  public static stashAndSave(testFilePath: string, testCode: string) {
    //If the file does already exist we should add it to git and stash its contents. We should skip this if not since it will cause an error with git.
    if (fs.existsSync(testFilePath)) {
      // TODO: inform the user we stashed the changes or find a better way to tell them it is gone
      console.log(`Stashing any uncommitted changes in ${testFilePath}...`);
      execSync(`git add ${testFilePath} && git stash push ${testFilePath}`);
    } else {
      fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
    }
    Files.writeFileSync(testFilePath, testCode);
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
}
