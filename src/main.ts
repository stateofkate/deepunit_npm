#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { TestingFrameworks } from './main.consts';
import { CONFIG, maxFixFailingTestAttempts, rootDir } from './lib/Config';
import { debugMsg, expectNot, isEmpty } from './lib/utils';
import { Api } from './lib/Api';

/**
 * Manually set configs
 */
let allFiles: boolean = true; // instead of grabbing list of files from last commit, recursively search all directories in the project for .ts or html files
let fixAttempts = 0;

function getChangedFiles(): string[] {
  const changedFilesCmd = 'git diff --name-only HEAD~1 HEAD';
  const output = execSync(changedFilesCmd).toString();
  return output.split('\n').filter(Boolean);
}

function getDiff(files: string[]): string {
  const diffCmd = `git diff --unified=0 HEAD~1 HEAD -- ${files.join(' ')}`;
  return execSync(diffCmd)
    .toString()
    .split('\n')
    .filter((line) => !line.trim().startsWith('-'))
    .join('\n');
}

function getFileContent(file: string | null): string {
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

function getExistingTestContent(file: string): string {
  let testVersion: string = '';
  try {
    testVersion = fs.readFileSync(file, 'utf-8');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Had an error in reading the file, woopsies');
      console.error(file);
      console.error(error);
      console.log('Need help? Email justin@deepunit.ai');
      process.exit(1);
    }
  }
  return testVersion;
}

function getTestName(file: string): string {
  const testFileName = file.split('.').slice(0, -1).join('.') + CONFIG.testExtension;
  return testFileName;
}

type FixManyErrorsResult = {
  fixedAllErrors: boolean;
  apiError: boolean;
  failedTests: string[];
  passedTests: string[];
};

/**
 * We will take in the list of test which were generated and then fix the errors in each one. We will return a list of fixed tests and still failing tests at the end.
 * @param tempTestPaths
 * @param diff
 * @param tsFileContent
 */
async function fixManyErrors(tempTestPaths: string[], diff: string, tsFileContent: string): Promise<FixManyErrorsResult> {
  let attempts = 0;
  // store the result globally so we can return the failed results at the end
  let result: FixManyErrorsResult = {
    fixedAllErrors: true,
    apiError: false,
    passedTests: [],
    failedTests: [],
  };

  while (attempts < maxFixFailingTestAttempts) {
    attempts++;

    // check the tests, see if it worked
    let result: {
      failedTests: string[];
      passedTests: string[];
      failedTestErrors: { [key: string]: string };
    } = runTestErrorOutput(tempTestPaths);

    // success case, no errors to fix
    if (!result.failedTests || result.failedTests.length <= 0) {
      return {
        fixedAllErrors: true,
        apiError: false,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
      };
    }
    let testFileName = result.failedTests.pop() || ''; // pop is optionally even though we check to confirm the array has a length above

    // TODO: don't fix the empty test error ".includes('Your test suite must contain at least one test.')"
    const errorMessage: string = result.failedTestErrors[testFileName];
    const testContent = getExistingTestContent(testFileName);

    try {
      const response = await Api.fixErrors(errorMessage, testFileName, testContent, diff, tsFileContent);

      if (response.fixedTest.trim() === '') {
        throw new Error('Fixed test returned empty');
      }

      // if no error and file exists, write file so we can test again
      writeFileSync(testFileName, response.fixedTest);
    } catch (error) {
      // if we get an API error or critical error, then we should NOT run through all the maxAttempts as it will just loop through again most likely throwing same error
      debugMsg(`Unable to fix test file: ${testFileName}, Error: ${error}`);
      return {
        fixedAllErrors: false,
        apiError: true,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
      };
    }
  }

  // if we have ran through all attempts and still fail, let the user know
  return {
    fixedAllErrors: false,
    apiError: false,
    failedTests: result?.failedTests,
    passedTests: result?.passedTests,
  };
}

function runJestTest(files: string[]) {
  process.chdir(rootDir);

  let relativePathArray: string[] = [];
  if (CONFIG.workspaceDir) {
    process.chdir(CONFIG.workspaceDir);
    for (let i = 0; i < files.length; i++) {
      let relativePath = path.relative(CONFIG.workspaceDir, files[i]);
      relativePathArray.push(relativePath);
    }
  } else {
    relativePathArray = files;
  }
  const formattedPaths = relativePathArray.join(' ');
  let result;
  try {
    const command = `npx jest --json ${formattedPaths} --passWithNoTests`;
    result = execSync(command, { stdio: ['pipe', 'pipe', 'pipe'] });
    process.chdir(rootDir);
  } catch (error: any) {
    process.chdir(rootDir);
    result = error;
    if (error.stdout) {
      result = JSON.parse(error.stdout.toString());
    } else {
      // If there's no stdout, rethrow the error
      throw error;
    }
  }
  if (!result.numFailedTestSuites) {
    return JSON.parse(result.toString());
  }
  return result;
}

/**
 * Currently the function returns an array of strings.
 * We would like to modify the function so that it tells us which pass and which fail. For failing tests it should give us the error
 * @param file
 */
function runTestErrorOutput(file: string[]): {
  failedTests: string[];
  passedTests: string[];
  failedTestErrors: { [key: string]: string };
} {
  process.chdir(rootDir);

  if (CONFIG.frontendFramework == 'angular') {
    // TODO: add support for jasmine back in
    console.error('##### TODO: add support for jasmine back in');
    process.exit();
  } else if (CONFIG.testingFramework === TestingFrameworks.jest) {
    const result = runJestTest(file);
    if (result.numFailedTestSuites === 0) {
      return { passedTests: file, failedTests: [], failedTestErrors: {} };
    } else if (result.testResults) {
      let passedTests: string[] = [];
      let failedTests: string[] = [];
      let failedTestErrors: any = {};
      for (const testResult of result.testResults) {
        const testPathFound: string | undefined = file.find((substring) => testResult.name.endsWith(substring));
        const testPath = testPathFound ? testPathFound : testResult.name;
        if (!testPath) {
          console.warn('unable to find the testPath');
        }
        if (testResult.status === 'failed') {
          if (testResult.message.includes('Your test suite must contain at least one test.')) {
            console.error('this test failed because it does not contain a test suite. Weird.');
          }
          failedTests.push(testPath);
          failedTestErrors[testPath] = testResult.message;
        } else if (testResult.status == 'passed') {
          passedTests.push(testPath);
        }
      }
      return { passedTests, failedTestErrors, failedTests };
    }
  }
  throw new Error(`Unsupported frontend framework: ${CONFIG.frontendFramework}`);
}

function groupFilesByDirectory(changedFiles: string[]): Record<string, string[]> {
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

function tsAndHtmlFromFile(file: string, filesInDirectory: string[]): [string | null, string | null, string | null] {
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

function checkIfJestTestPasses(testFile: string): boolean {
  const result = runJestTest([testFile]);
  let mustContain = 0;
  if (result.testResults) {
    for (const testResult of result.testResults) {
      if (testResult.message.includes('Your test suite must contain at least one test.')) {
        mustContain++;
      }
    }
  }
  if (result.numFailedTestSuites === 0 || result.numFailedTestSuites - mustContain === 0) {
    return true;
  }
  return 0 === result.numFailedTestSuites;
}

function checkIfAngularTestsPass(testFile: string): boolean {
  let output;
  try {
    output = execSync(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${testFile}`).toString();
  } catch (error) {
    return false;
  }

  if (parseFailedAngularTestOutput(output)) {
    console.error(
      `DeepUnit was unable to run because the above tests are failing. Please fix them if your last commit broke them or deleted their content and let us regenerate new ones`,
    );
    process.exit();
  }

  return true;
}

function printSummary(failingTests: string[], testsWithErrors: string[], passingTests: string[], apiErrors: string[], testRunResults: string[]): void {
  if (testRunResults) {
    console.log('Here are the final results from running the tests:');
    for (const result of testRunResults) {
      console.log(result);
    }
  }

  console.log('#####################################');
  console.log('##### Summary of DeepUnitAI Run #####');
  console.log('#####################################');

  if (failingTests.length > 0) {
    console.log('\nThe following tests were failing after your last commit. You will need to fix them before we can write new tests for you.:');
    for (const test of failingTests) {
      console.log(`     ${test}`);
    }
  }

  if (testsWithErrors.length > 0) {
    console.log('\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:');
    for (const test of testsWithErrors) {
      console.log(`     ${test}`);
    }
  }

  if (passingTests.length > 0) {
    console.log('\nWe successfully generated tests for the following files, and they pass without errors:');
    for (const test of passingTests) {
      console.log(`     ${test}`);
    }
  }

  if (apiErrors.length > 0) {
    console.log(
      "\nWe had API errors while generating the following tests, see the logs above.\nTry again and if you're seeing this frequently bother Justin@deepunit.ai to find a fix this:",
    );
    for (const test of apiErrors) {
      console.log(`     ${test}`);
    }
  }

  console.log('\n');
}

function createFile(filename: string): void {
  // Create a new file
  fs.writeFileSync(filename, '');

  // Run git add on the file
  try {
    execSync(`git add ${filename}`);
  } catch (error) {
    console.error(filename);
    console.error(error);
    console.error(`Error running git add: `);
  }
}

function findFiles(extensions: string[], ignoreExtensions: string[]): string[] {
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
function filterFiles(files: string[]): string[] {
  const filteredFiles: string[] = [];

  const combinedIgnoredDirs = CONFIG.ignoredDirectories.map((dir) => path.join(CONFIG.workspaceDir, dir));

  const combinedIgnoredFiles = CONFIG.ignoredFiles.map((file) => path.join(CONFIG.workspaceDir, file));

  for (const file of files) {
    if (!combinedIgnoredDirs.some((ignoreDir) => isParentAncestorOfChild(ignoreDir, file)) && !combinedIgnoredFiles.some((ignoreFile) => file == ignoreFile)) {
      filteredFiles.push(file);
    }
  }
  return filteredFiles;
}

function isParentAncestorOfChild(parent: string, child: string) {
  const rel = path.relative(parent, child);
  return !rel.startsWith('../') && rel !== '..';
}

/**
 * Parse the test output to find if tests all pass.
 *
 *   Parameters:
 *   output (str): The test output.
 */
function parseFailedAngularTestOutput(output: string): boolean {
  const match = output.match(/TOTAL: (\d+) FAILED, (\d+) SUCCESS/);

  if (match) {
    const failedTests = parseInt(match[1]);
    const successfulTests = parseInt(match[2]);
    return failedTests < 1; // if any tests failed return false
  } else {
    const executedMatch = output.match(/Executed (\d+) of/);
    if (executedMatch) {
      return true; // this should occur because we had no tests in the specified file, but there were no other errors in the other files
    } else {
      return false; // There was an error in this case
    }
  }
}

function writeTestsToFiles(tests: Record<string, string>, skip: boolean): string[] {
  if (skip) {
    return [];
  }
  let testPaths: string[] = [];
  for (const [testFilePath, testCode] of Object.entries(tests)) {
    stashAndSave(testFilePath, testCode);
    testPaths.push(testFilePath);
  }
  return testPaths;
}

function stashAndSave(testFilePath: string, testCode: string) {
  //If the file does already exist we should add it to git and stash its contents. We should skip this if not since it will cause an error with git.
  if (fs.existsSync(testFilePath)) {
    // TODO: inform the user we stashed the changes or find a better way to tell them it is gone
    console.log(`Stashing any uncommitted changes in ${testFilePath}...`);
    execSync(`git add ${testFilePath} && git stash push ${testFilePath}`);
  } else {
    fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
  }
  writeFileSync(testFilePath, testCode);
}

function writeFileSync(file: string, data: string, options?: any) {
  try {
    fs.writeFileSync(file, data, options);
  } catch (e) {
    console.error({ data, options });
    console.error(`Unable to write file: ${file}`);
  }
}

async function recombineTests(tempTestPaths: string[], finalizedTestPath: string) {
  if (tempTestPaths.length < 0) {
    return '';
  }

  const testFiles = [];
  for (let filePath of tempTestPaths) {
    const content = fs.readFileSync(filePath).toString();
    testFiles.push(content);
  }

  const responseData = await Api.recombineTests(testFiles);
  if (responseData && responseData.testContent) {
    writeFileSync(finalizedTestPath, responseData.testContent);
  }
}

function deleteTempFiles(tempTestPaths: string[]) {
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

/**
 * If DeepUnit is run with the --f, --file or --files flag it will looks for a list of files and return it as an array
 * Example npm run deepunit -- --f main.ts subfolder/number.ts will return ['main.ts', 'subfolder/number.ts']
 */
function getFilesFlag(): string[] {
  const args = process.argv.slice(2);
  let files: string[] = [];

  args.forEach((arg, index) => {
    if (arg === '--f' || arg === '--file' || arg === '--files') {
      files = files.concat(args[index + 1].split(','));
    }
  });

  return files;
}

export async function main() {
  console.log('#################################################');
  console.log('##### Generating unit tests with DeepUnitAI #####');
  console.log('#################################################');

  // Get files that need to be tested
  let filesToWriteTestsFor: string[];
  const filesFlagArray: string[] = getFilesFlag();
  if (filesFlagArray) {
    filesToWriteTestsFor = filesFlagArray;
  } else if (allFiles) {
    filesToWriteTestsFor = findFiles([CONFIG.typescriptExtension, '.html'], ['.spec.ts', '.test.tsx', '.test.ts', '.consts.ts', '.module.ts']);
  } else {
    filesToWriteTestsFor = getChangedFiles();
  }
  const filteredChangedFiles = filterFiles(filesToWriteTestsFor);
  const filesByDirectory = groupFilesByDirectory(filteredChangedFiles);

  let failingTests: string[] = [];
  let testsWithErrors: string[] = [];
  let passingTests: string[] = [];
  let testRunResults: string[] = []; //TODO: this is never assigned, we need to fix that so the summary is correct
  let apiErrors: string[] = [];
  let firstRun: boolean = true;
  for (const directory in filesByDirectory) {
    let filesInDirectory = filesByDirectory[directory];
    while (filesInDirectory.length > 0) {
      const file = filesInDirectory.pop();
      if (file === undefined) {
        continue;
      }
      const testFile = getTestName(file);

      if (firstRun && CONFIG.testingFramework === TestingFrameworks.jasmine) {
        checkIfAngularTestsPass(testFile);
        firstRun = false;
      } else if (firstRun && CONFIG.testingFramework === TestingFrameworks.jest) {
        checkIfJestTestPasses(testFile);
      }

      if (!fs.existsSync(testFile)) {
        // check if the file exists, if it does then we should create a file
        // TODO: we should do this afterward, so we don't create empty files
        createFile(testFile);
      }

      const testContent = getExistingTestContent(testFile);
      const [tsFile, htmlFile, correspondingFile] = tsAndHtmlFromFile(file, filesInDirectory);

      let filesToPass = [];
      if (tsFile && tsFile != correspondingFile) {
        filesToPass.push(tsFile);
      }
      if (htmlFile && htmlFile != correspondingFile) {
        filesToPass.push(htmlFile);
      }

      const diff = getDiff(filesToPass);
      const tsFileContent: string = getFileContent(tsFile);
      const htmlFileContent = getFileContent(htmlFile);

      let tempTestPaths: string[] = [];
      const response = await Api.generateTest(diff, tsFile, tsFileContent, htmlFile, htmlFileContent, testFile, testContent);

      // error with API response, unable generate test
      if (!response || isEmpty(response.tests)) {
        apiErrors.push(testFile);
        continue;
      }

      try {
        const tests = response.tests;
        // TODO: fix the issue with which files  so we can
        tempTestPaths = writeTestsToFiles(tests, false);
      } catch (error) {
        console.error('Caught error trying to writeTestsToFiles');
        apiErrors.push(testFile);
      }

      const { fixedAllErrors, apiError } = await fixManyErrors(tempTestPaths, diff, tsFileContent);

      //We will need to recombine all the tests into one file here after they are fixed and remove any failing tests
      await recombineTests(tempTestPaths, testFile);

      //then we will need to delete all the temp test files.
      deleteTempFiles(tempTestPaths);

      if (apiError) {
        console.log('API error encountered');
        apiErrors.push(testFile);
        continue;
      }

      testRunResults.push(`\n     Result for: ${testFile}`);
      // testRunResults.push(runResults); TODO: add back testResults
      if (fixedAllErrors) {
        passingTests.push(testFile);
      } else {
        testsWithErrors.push(testFile);
      }
    }
  }

  printSummary(failingTests, testsWithErrors, passingTests, apiErrors, testRunResults);

  process.exit(100);
}

if (require.main === module) {
  main();
}
