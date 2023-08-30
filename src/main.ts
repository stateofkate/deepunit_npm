#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import axios from 'axios';
import * as readline from 'readline';
import ts from 'typescript';
import { mockedGenerationConst } from './main.consts';
import { grabFromConfig } from './utils';
import {
  detectProjectType,
  detectTestFramework,
  detectWorkspaceDir,
} from './configDetector';

/** Automatically Detected Project configs
 * These configs are first pulled from deepunit.config.json, if absent we will try to use the detect*() Function to autodetect
 */
export type Config = {
  workspaceDir: string;
  frontendFramework: string;
  testExtension: string;
  testingFramework: string;
};
let config: Config = {
  workspaceDir: '',
  frontendFramework: '',
  testExtension: '',
  testingFramework: '',
};

let scriptTarget: string = '';
let typescriptExtension: string = '';

export const rootDir: string = process.cwd();

/**
 * Manually set configs
 */
let verboseLogging: boolean = true;
let allFiles: boolean = true; // grab list of files from last commit or recursively search all directories in the project for .ts or html files
let defaultIgnore: string[] = [
  'node_modules',
  '.angular',
  '.idea',
  'dist',
  'git_hooks',
  'src',
]; // Paths that most projects will never want to unit test
let ignoredFiles: string[] = [
  'index.html',
  'index.tsx',
  'polyfills.ts',
  'test.ts',
  'main.ts',
  'environments/environment.ts',
  'environments/environment.prod.ts',
]; // ignore file paths ending in these names
let onlyTestFixErrors: boolean = false;
let mockGenerationApiResponse: boolean = false;
const mockedGeneration = mockedGenerationConst;

// Api paths
let prodBase: string = 'https://dumper.adaptable.app';
let generateApiPath: string = `${prodBase}/generate-test/new`;
let fixErrorApiPath: string = `${prodBase}/generate-test/fix-error`;
let testApiPath: string = `${prodBase}/generate-test/test-code`;
let password: string = 'nonerequired';
let version: string = '0.3.0';

let fixAttempts = 0;

export function detectTsconfigTarget() {
  let tsconfigPath: string | null = path.join(
    config.workspaceDir,
    'tsconfig.json',
  );
  let typescriptExtension = '.ts';

  while (tsconfigPath) {
    if (fs.existsSync(tsconfigPath)) {
      let contents = fs.readFileSync(tsconfigPath, 'utf8');
      try {
        let tsconfigJson = ts.parseConfigFileTextToJson('', contents);
        scriptTarget = tsconfigJson.config?.compilerOptions?.target
          ? tsconfigJson.config?.compilerOptions?.target
          : undefined;
        if (tsconfigJson.config?.compilerOptions?.jsx) {
          typescriptExtension = '.tsx';
        }
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
        console.error(
          'Error parsing tsconfig.json. JSON does not support comments. Please remove the comment at the top of ' +
            tsconfigPath +
            ' and try again.',
        );
        console.log('Need help? Email justin@deepunit.ai');
        process.exit(1);
      }
    } else {
      console.error('Error: unable to find tsconfig at ' + tsconfigPath);
      console.error('The current working director is ' + process.cwd());
      console.error(
        'Please notify the appropriate team to add a tsconfig path config',
      );
      console.log('Need help? Email justin@deepunit.ai');
      process.exit(1);
    }
  }

  console.log('Detected ES target: ' + scriptTarget);
  return scriptTarget;
}

export function detectTypescriptExtension(): void {
  const configTypescript = grabFromConfig('typescriptExtension');
  if (configTypescript) {
    typescriptExtension = configTypescript;
  } else if (typescriptExtension) {
    console.log('found it in the tsconfig');
  } else if (config.frontendFramework === 'react') {
    typescriptExtension = '.tsx';
  } else if (config.frontendFramework === 'angular') {
    typescriptExtension = '.ts';
  } else {
    typescriptExtension = '.ts';
  }
  console.log('Typescript extension is : ' + typescriptExtension);
}

export function debug(inputString: string, doProd = false) {
  let doDebug = false;
  if (doDebug) {
    console.debug(inputString);
  }
  if (doProd) {
    console.log(inputString);
  }
}

export function getChangedFiles(): string[] {
  const changedFilesCmd = 'git diff --name-only HEAD~1 HEAD';
  const output = execSync(changedFilesCmd).toString();
  return output.split('\n').filter(Boolean);
}

export function getDiff(files: string[]): string {
  const diffCmd = `git diff --unified=0 HEAD~1 HEAD -- ${files.join(' ')}`;
  return execSync(diffCmd)
    .toString()
    .split('\n')
    .filter((line) => !line.trim().startsWith('-'))
    .join('\n');
}

export function getFileContent(file: string | null): string {
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
        console.error(
          `An error occurred while trying to read ${file}: ${error}`,
        );
      }
    }
    return '';
  }
}
export function getTestVersion(file: string): string {
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

export function getDirectory(file: string): string {
  return path.dirname(file);
}

export function getTestName(file: string): string {
  console.log(testExtension);
  const testFileName = file.split('.').slice(0, -1).join('.') + testExtension;
  return testFileName;
}
type generateTestData = {
  diffs: string;
  frontendFramework: string;
  testingFramework: string;
  scriptTarget: string;
  version: string;
  tsFile?: { [key: string]: string };
  htmlFile?: { [key: string]: string };
  testFile?: { [key: string]: string };
  password: string;
};
export async function generateTest(
  diffs: string,
  tsFile: string | null,
  tsFileContent: string | null,
  htmlFile: string | null,
  htmlFileContent: string | null,
  testFile: string,
  testVersion: string,
): Promise<undefined | any> {
  console.log('started');
  console.log(testFile);
  console.log(testVersion);
  console.log('done');
  const headers = { 'Content-Type': 'application/json' };
  let data: generateTestData = {
    diffs,
    frontendFramework: config.frontendFramework,
    testingFramework: config.testingFramework,
    scriptTarget: scriptTarget,
    version,
    password,
  };
  if (tsFile && tsFileContent) {
    data.tsFile = { [tsFile]: tsFileContent };
  }
  if (htmlFile && htmlFileContent) {
    data.htmlFile = { [htmlFile]: htmlFileContent };
  }
  if (testFile || testVersion) {
    data.testFile = { [testFile]: testVersion };
  }
  console.log(data);
  console.log(`Generating test for tsFile: ${tsFile}, htmlFile: ${htmlFile}`);

  try {
    const response = mockGenerationApiResponse
      ? mockedGeneration
      : await axios.post(generateApiPath, data, { headers });
    console.log('response');
    console.log(response);
    return response.data;
  } catch (error) {
    console.error(`Failed with error: ${error}`);
    return undefined;
  }
}
export function prettyPrintJson(jsonObj: Record<string, any>, doProd = true) {
  debug(JSON.stringify(jsonObj, null, 2), doProd);
}
const errorPattern = /Error: (.*?):(.*?)\n/;
export enum testingFrameworks {
  jest = 'jest',
  angular = 'angular',
}

/**
 * We will take in the list of test which were generated and then fix the errors in each one. We will return a list of fixed tests and still failing tests at the end.
 * @param tempTestPaths
 * @param diff
 * @param tsFile
 * @param tsFileContent
 */
export async function fixManyErrors(
  tempTestPaths: string[],
  diff: string,
  tsFile: string | null,
  tsFileContent: string | null,
): Promise<{
  fixedAllErrors: boolean;
  runResults: string;
  apiError: boolean;
  failedTests: string[];
  passedTests: string[];
}> {
  let errors = ''; //todo: runResults which is used for the summary which is dependent on this variable, but its never assigned. We should remove it or update it
  let attempts = 0;

  if (!errorPattern) {
    throw new Error(
      `Unsupported testing framework: ${config.testingFramework}`,
    );
  }
  let result: {
    failedTests: string[];
    passedTests: string[];
    failedTestErrors: { [key: string]: string };
  } = runTestErrorOutput(tempTestPaths);
  console.log(result);
  console.log('matches');
  console.log(result.failedTests);
  const maxAttempts = 7;
  let fixedTestCode: string = '';
  while (attempts < maxAttempts && result.failedTests.length > 0) {
    //todo: refactor all this logic into an async helper function so that we can fix multiple tests at once
    console.log(
      ' ',
      '##########################################################\n',
      '################### Begin fixing error ###################\n',
      '##########################################################',
    );

    if (!result.failedTests) {
      console.log(result);
      console.log(`Fixed all errors for ${tempTestPaths}`);
      //todo: recombine all tests into one file
      return {
        fixedAllErrors: true,
        runResults: errors,
        apiError: false,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
      };
    }
    let popped = result.failedTests.pop();
    let match: string = popped ? popped : '';

    console.log(result.failedTests.length);
    if (match === '') {
      console.error(popped);
      console.log('that was the popped');
      console.error(result);
      console.error(
        "match was undefined, I don't think this could ever happen, if you're seeing this maybe debug?",
      );
      attempts++;
    } else if (
      match.includes('Your test suite must contain at least one test.')
    ) {
      //never fix the empty test error
      if (result.failedTests.length <= 1) {
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        console.log('###### Big break!!!!');
        break;
      }
      continue;
    }
    const errorString: string = result.failedTestErrors[match]; // seems like some old angular logic which we should revisit when we fix angular/jasmine support testingFramework === 'jasmine' ? `${match[0]}${match[1]}` : match;
    console.log(`Fixing error: ${errorString}`);
    const testVersion = getTestVersion(match);
    const headers = { 'Content-Type': 'application/json' };
    const data = {
      error_message: errorString,
      test_code: testVersion,
      diff,
      ts_file_name: match,
      ts_file_content: tsFileContent,
      script_target: scriptTarget,
      frontend_framework: config.frontendFramework,
      testingFramework: config.testingFramework,
      version,
      password,
    };

    try {
      fixAttempts++;
      const response = await axios.post(fixErrorApiPath, data, {
        headers,
      });
      console.log(response);
      console.log(fixAttempts);
      if (response.data.error) {
        console.error(response.data.error);
        attempts++;
        continue;
      }
      fixedTestCode = response.data.fixed_test;
      if (fixedTestCode.trim() === '') {
        console.log(
          'The fixed test was empty, lets throw this away and start again!',
        );
        attempts++;
        continue;
      }
      writeFileSync(match, fixedTestCode);
      console.log(fixedTestCode);
    } catch (error) {
      console.log('ran into error making api request in fix-error');
      console.log(error);
      attempts++;
      continue;
    }
    attempts++;
    result = runTestErrorOutput(tempTestPaths);
  }
  console.log('Attempts: ' + attempts);
  console.log('result.failedTests.length: ' + result.failedTests.length);
  console.log(result.failedTests);
  if (result.failedTests.length > 0) {
    console.log('there are still result.failedTests, erorrs sadly');
    console.log(`Unable to fix all errors...`);
    return {
      fixedAllErrors: false,
      runResults: errors,
      apiError: false,
      failedTests: result.failedTests,
      passedTests: result.passedTests,
    };
  } else {
    console.log('attempts: ' + attempts + ' not its not: ' + (maxAttempts - 1));
  }
  return {
    fixedAllErrors: true,
    runResults: errors,
    apiError: false,
    failedTests: result.failedTests,
    passedTests: result.passedTests,
  };
}
/*export async function fixErrors(
    file: string,
    testVersion: string,
    diff: string,
    tsFile: string | null,
    tsFileContent: string | null
): Promise<{fixedAllErrors: boolean, runResults: string, apiError: boolean, fixedTest: string | null}> {
    let errors = '';
    let attempts = 0;

    if (!errorPattern) {
        throw new Error(`Unsupported testing framework: ${testingFramework}`);
    }
    let matches: string[] = await runTestErrorOutput(file);
    const maxAttempts = 7;
    let fixedTestCode: string = '';
    let contiues = 0;
    while (attempts < maxAttempts && matches.length>0) {
        console.log(' ', '##########################################################\n', '################### Begin fixing error ###################\n', '##########################################################');

        if (!matches) {
            console.log(matches)
            console.log(`Fixed all errors for ${file}`);
            return {fixedAllErrors: true, runResults: errors, apiError: false, fixedTest: testVersion};
        }

        console.log(matches.length)
        const match: string | undefined = matches.pop();
        console.log(matches.length)
        if(match === undefined) {
            console.log(match)
            console.log('that was the match')
            console.log(matches)
            console.log("match was undefined, I don't think this could ever happen, but if it did it could cause an infinite loop")
            contiues++
            continue;
        } else if(match.includes('Your test suite must contain at least one test.')) {
            //never fix the empty test error
            if(matches.length<=1) {
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                console.log("###### Big break!!!!")
                break;
            }
            contiues++
            continue;
        }
        const errorString = testingFramework === 'jasmine' ? `${match[0]}${match[1]}` : match;
        console.log(`Fixing error: ${errorString}`);

        const headers = { 'Content-Type': 'application/json' };
        const data = {
            error_message: errorString,
            test_code: testVersion,
            diff,
            ts_file_name: tsFile,
            ts_file_content: tsFileContent,
            script_target: scriptTarget,
            frontend_framework: config.frontendFramework,
            testingFramework: testingFramework,
            version,
            password
        };



        try {
            counter++
            const response = /!*mockFixingApiResponse ? {data: {fixed_test: 'mocked fixed test code'}} :*!/ await axios.post(fixErrorApiPath, data, { headers });
            console.log(response)
            console.log(counter)
            if(response.data.error) {
                console.error(response.data.error)
                continue
            }
            fixedTestCode = response.data.fixed_test;
            console.log(fixedTestCode)
            if(fixedTestCode.trim() === '') {
                console.log("The fixed test was empty, lets throw this away and start again!")
                attempts++;
                continue;
            }
            fs.writeFileSync(file, fixedTestCode);
        } catch (error) {
            console.log('ran into error making api request in fix-error')
            console.log(error)
            return {fixedAllErrors: false, runResults: errors, apiError: true, fixedTest: null};
        }
        attempts++;
        matches = runTestErrorOutput(file);
    }
    console.log('Attempts: ' + attempts)
    console.log('matches.length: ' + matches.length)
    console.log(matches)
    if (matches.length > 0) {
        console.log('there are still matches, erorrs sadly')
        console.log(`Unable to fix all errors, resetting any uncommitted changes in ${file}...`);
        execSync(`git add ${file} && git checkout ${file}`);
        return {fixedAllErrors: false, runResults: errors, apiError: false, fixedTest: fixedTestCode};
    } else {
        console.log('attempts: ' + attempts + ' not its not: ' + (maxAttempts-1))
    }
    return {fixedAllErrors: true, runResults: errors, apiError: false, fixedTest: null};
}*/

export function runJestTest(file: string[]) {
  process.chdir(rootDir);

  let relativePathArray: string[] = [];
  if (config.workspaceDir) {
    process.chdir(config.workspaceDir);
    for (let i = 0; i < file.length; i++) {
      let relativePath = path.relative(config.workspaceDir, file[i]);
      relativePathArray.push(relativePath);
    }
  } else {
    relativePathArray = file;
  }
  const formattedPaths = relativePathArray.join(' ');
  let result;
  try {
    console.log(file);
    const command = `npx jest --json ${formattedPaths} --passWithNoTests`;
    console.log('I command you');
    console.log(command);
    result = execSync(command, { stdio: ['pipe', 'pipe', 'pipe'] });
    process.chdir(rootDir);
  } catch (error: any) {
    process.chdir(rootDir);
    result = error;
    if (error.stdout) {
      result = JSON.parse(error.stdout.toString());
      /*console.log(result)*/
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
export function runTestErrorOutput(file: string[]): {
  failedTests: string[];
  passedTests: string[];
  failedTestErrors: { [key: string]: string };
} {
  process.chdir(rootDir);

  let result: Buffer;
  let stdout;
  let stderr;

  if (config.frontendFramework === 'angular') {
    console.log('##### TODO: add support for jasmine back in');
    console.log('##### TODO: add support for jasmine back in');
    console.log('##### TODO: add support for jasmine back in');
    console.log('##### TODO: add support for jasmine back in');
    console.log('##### TODO: add support for jasmine back in');
    process.exit();
    /*const errorPattern = /Error: (.*?):(.*?)\n/;
            let relativeFilePathArray: string[] = [];
            if (environment.workspaceDir) {
                process.chdir(environment.workspaceDir);
                for(const filePath of file) {
                    let relativeTestFilePath = path.relative(environment.workspaceDir, filePath);
                    relativeFilePathArray.push(relativeTestFilePath)
                }

            } else {
                relativeFilePathArray = Array.isArray(file) ? relativeFilePathArray : [file];
            }
            result = execSync(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${relativeFilePathArray}`, { stdio: 'pipe' });
            stdout = result.toString();
            process.chdir(rootDir);
            return stdout.match(errorPattern) || [];*/
  } else if (config.testingFramework === 'jest') {
    console.log('in the jest part');
    const result = runJestTest(file);
    console.log(result);
    if (result.numFailedTestSuites === 0) {
      console.log('is 0');
      return { passedTests: file, failedTests: [], failedTestErrors: {} };
    } else if (result.testResults) {
      console.log(
        'We have some failing test suites, count is: ' +
          result.numFailedTestSuites,
      );
      console.log(result);
      let passedTests: string[] = [];
      let failedTests: string[] = [];
      let failedTestErrors: any = {};
      for (const testResult of result.testResults) {
        const testPathFound: string | undefined = file.find((substring) =>
          testResult.name.endsWith(substring),
        );
        const testPath = testPathFound ? testPathFound : testResult.name;
        if (!testPath) {
          console.log('unable to find the testPAth for the return');
          console.log(testResult);
          console.log(file);
        }
        if (testResult.status == 'failed') {
          if (
            testResult.message.includes(
              'Your test suite must contain at least one test.',
            )
          ) {
            console.log(
              'this test failed because it does not contain a test suite. Weird.',
            );
            console.log(testResult);
            console.log(file);
          }
          failedTests.push(testPath);
          failedTestErrors[testPath] = testResult.message;
        } else if (testResult.status == 'passed') {
          passedTests.push(testPath);
        }
      }
      return { passedTests, failedTestErrors, failedTests };
      /*console.log(result.testResults[0].message)
                const splitted = result.testResults[0].message.split(file)
                console.log(splitted.length)
                let finalArray = []
                for(const splitty of splitted) {
                    console.log('#### splitty')
                    const errorString = file + splitty
                    console.log(errorString)
                    finalArray.push(errorString)
                }*/
    }
  }
  throw new Error(
    `Unsupported frontend framework: ${config.frontendFramework}`,
  );
}

export function runTest(file: string): string {
  let relativeTestFilePath = file;
  process.chdir(rootDir);

  let result;
  let stdout;

  if (config.frontendFramework === 'angular') {
    const command = [];
    if (fs.existsSync(file)) {
      if (config.workspaceDir) {
        process.chdir(config.workspaceDir);
        relativeTestFilePath = path.relative(config.workspaceDir, file);
      }
      result = execSync(
        `ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${relativeTestFilePath}`,
        { stdio: 'pipe' },
      );
    } else {
      if (config.workspaceDir) {
        process.chdir(config.workspaceDir);
      }
      result = execSync(
        'ng test --browsers=ChromeHeadless --no-watch --no-progress',
        { stdio: 'pipe' },
      );
    }
    stdout = result.toString();
    process.chdir(rootDir);
  } else if (config.frontendFramework === 'react') {
    if (config.workspaceDir) {
      process.chdir(config.workspaceDir);
      relativeTestFilePath = path.relative(config.workspaceDir, file);
    }
    result = execSync(`npx jest ${relativeTestFilePath}`, {
      stdio: 'pipe',
    });
    stdout = result.toString();
    process.chdir(rootDir);
  } else {
    throw new Error(
      `Unsupported frontend framework: ${config.frontendFramework}`,
    );
  }

  return stdout;
}
export function getInput(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('Do you want to continue fixing errors? (y/n): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'n') {
        resolve(false);
      } else if (answer.toLowerCase() === 'y') {
        console.log('Y received, continuing execution');
        resolve(true);
      } else {
        console.log('Invalid input. Please enter y or n.');
        resolve(getInput());
      }
    });
  });
}
export function groupFilesByDirectory(
  changedFiles: string[],
): Record<string, string[]> {
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
export function tsAndHtmlFromFile(
  file: string,
  filesInDirectory: string[],
): [string | null, string | null, string | null] {
  const baseFile = path.basename(file, path.extname(file));
  const extension = path.extname(file);
  let correspondingFile: string | null = null;

  if (extension === typescriptExtension) {
    correspondingFile = `${baseFile}.html`;
  } else if (extension === '.html') {
    correspondingFile = `${baseFile}${typescriptExtension}`;
  }

  let htmlFile: string | null = null;
  let tsFile: string | null = null;

  if (correspondingFile && filesInDirectory.includes(correspondingFile)) {
    if (extension === typescriptExtension) {
      tsFile = file;
      htmlFile = correspondingFile;
    } else {
      tsFile = correspondingFile;
      htmlFile = file;
    }
  } else {
    if (extension === typescriptExtension) {
      tsFile = file;
    } else {
      htmlFile = file;
    }
  }

  return [tsFile, htmlFile, correspondingFile];
}
async function testCode(): Promise<void> {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const response = await axios.post(testApiPath, {}, { headers });
    console.log(response);
  } catch (error) {
    console.log(error);
  }
  console.log('Need help? Email justin@deepunit.ai');
  process.exit();
}
export function checkIfJestTestPasses(testFile: string): boolean {
  console.log(`Checking if ${testFile} passes before attempting to modify it`);
  const result = runJestTest([testFile]);
  debug(result, verboseLogging);
  let mustContain = 0;
  if (result.testResults) {
    for (const testResult of result.testResults) {
      if (
        testResult.message.includes(
          'Your test suite must contain at least one test.',
        )
      ) {
        mustContain++;
      }
    }
  }
  if (
    result.numFailedTestSuites === 0 ||
    result.numFailedTestSuites - mustContain === 0
  ) {
    return true;
  }
  return 0 === result.numFailedTestSuites;
}
export function checkIfAngularTestsPass(testFile: string): boolean {
  console.log(`Checking if all Angular tests pass`);

  let output;
  try {
    output = execSync(
      `ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${testFile}`,
    ).toString();
  } catch (error) {
    console.log(error);
    console.log(`Error running tests: ${error}`);
    return false;
  }

  console.log(`Output for Angular tests`);
  console.log(output);

  if (parseFailedAngularTestOutput(output)) {
    console.log(output);
    console.log(
      `DeepUnit was unable to run because the above tests are failing. Please fix them if your last commit broke them or deleted their content and let us regenerate new ones`,
    );
    console.log('Need help? Email justin@deepunit.ai');
    process.exit();
  }

  return true;
}
export function printSummary(
  failingTests: string[],
  testsWithErrors: string[],
  passingTests: string[],
  apiErrors: string[],
  testRunResults: string[],
): void {
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
    console.log(
      '\nThe following tests were failing after your last commit. You will need to fix them before we can write new tests for you.:',
    );
    for (const test of failingTests) {
      console.log(`     ${test}`);
    }
  }

  if (testsWithErrors.length > 0) {
    console.log(
      '\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:',
    );
    for (const test of testsWithErrors) {
      console.log(`     ${test}`);
    }
  }

  if (passingTests.length > 0) {
    console.log(
      '\nWe successfully generated tests for the following files, and they pass without errors:',
    );
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
export function doesFileExist(filename: string): boolean {
  return fs.existsSync(filename);
}
export function createFile(filename: string): void {
  // Create a new file
  fs.writeFileSync(filename, '');
  console.log('created f');
  console.log(filename);

  // Run git add on the file
  try {
    execSync(`git add ${filename}`);
    console.log(execSync(`git status`).toString());
  } catch (error) {
    console.error(filename);
    console.error(error);
    console.error(`Error running git add: `);
  }
}
export function findFiles(
  extensions: string[],
  ignoreExtensions: string[],
): string[] {
  /**
    Find all files in all nested directories within workspaceDir with the given extensions and ignore files with the given ignoreExtensions.

        Parameters:
    extensions (list): List of extensions to match.
    ignoreExtensions (list): List of extensions to ignore.

        Returns:
    list: List of full paths to files that match the given extensions and do not match the ignoreExtensions.
    */
  const matches: string[] = [];
  const walkDir = config.workspaceDir || 'src'; // replace with actual workspaceDir if needed

  function walk(directory: string) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const fullPath = path.join(directory, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (
        extensions.some((ext) => file.endsWith(ext)) &&
        !ignoreExtensions.some((ext) => file.endsWith(ext))
      ) {
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
 *   list: List of file paths that are not within the ignoreDirectories, defaultIgnore directories, and do not match filenames in ignoredFiles.
 */
export function filterFiles(files: string[]): string[] {
  const filteredFiles: string[] = [];
  const ignoreDirectories = ['dir1', 'dir2']; // replace with your ignore directories
  const defaultIgnore = ['defaultIgnore1', 'defaultIgnore2']; // replace with your default ignore directories
  const ignoredFiles = ['ignoreFile1', 'ignoreFile2']; // replace with your ignore files
  const workspaceDir = 'workspaceDir'; // replace with your workspace directory

  const combinedIgnoreDirs = ignoreDirectories
    .concat(defaultIgnore)
    .map((dir) => path.join(workspaceDir, dir));

  for (const file of files) {
    if (
      !combinedIgnoreDirs.some((ignoreDir) => file.includes(ignoreDir)) &&
      !ignoredFiles.some((ignoreFile) => file.endsWith(ignoreFile))
    ) {
      filteredFiles.push(file);
    }
  }

  return filteredFiles;
}

/**
 * Parse the test output to find if tests all pass.
 *
 *   Parameters:
 *   output (str): The test output.
 */
export function parseFailedAngularTestOutput(output: string): boolean {
  const match = output.match(/TOTAL: (\d+) FAILED, (\d+) SUCCESS/);

  if (match) {
    const failedTests = parseInt(match[1]);
    const successfulTests = parseInt(match[2]);
    console.log(
      `Matched, found ${failedTests} and also found: ${successfulTests}`,
    );
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
export function writeTestsToFiles(
  tests: Record<string, string>,
  skip: boolean,
): string[] {
  if (skip) {
    return [];
  }
  console.log(tests);
  console.log('its saving');
  console.log(process.cwd());
  let testPaths: string[] = [];
  for (const [testFilePath, testCode] of Object.entries(tests)) {
    console.log(testFilePath);
    stashAndSave(testFilePath, testCode);
    testPaths.push(testFilePath);
  }
  return testPaths;
}

export function stashAndSave(testFilePath: string, testCode: string) {
  console.log(process.cwd());
  console.log(testFilePath);
  //If the file does already exist we should add it to git and stash its contents. We should skip this if not since it will cause an errow ith git.
  if (fs.existsSync(testFilePath)) {
    console.log(`Stashing any uncommitted changes in ${testFilePath}...`);
    execSync(`git add ${testFilePath} && git stash push ${testFilePath}`);
  } else {
    fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
  }
  writeFileSync(testFilePath, testCode);
  console.log(testFilePath);
  console.log(testCode);
}

export function writeFileSync(file: string, data: string, options?: any) {
  try {
    fs.writeFileSync(file, data, options);
  } catch (e) {
    console.error('ran into an issue writing this file');
    console.log(file);
    console.log(data);
    console.log(options);
  }
}

export function getUrls() {
  const doProd = grabFromConfig('doProd');
  generateApiPath = doProd
    ? `${prodBase}/generate-test/new`
    : 'http://localhost:8080/generate-test/new';
  fixErrorApiPath = doProd
    ? `${prodBase}/generate-test/fix-error`
    : 'http://localhost:8080/generate-test/fix-error';
  testApiPath = doProd
    ? `${prodBase}/generate-test/test-code`
    : 'http://localhost:8080/generate-test/test-code';
  password = grabFromConfig('password') || 'nonerequired';
}
export class newClass {}

export function recombineTests(needImplementing: boolean) {
  if (needImplementing) {
    console.log('Implement recombineTests()!!!!');
    console.log('Implement recombineTests()!!!!');
    console.log('Implement recombineTests()!!!!');
    console.log('Implement recombineTests()!!!!');
    process.exit();
  }
}

function deleteTempFiles(tempTestPaths: string[], needImplementing: boolean) {
  if (needImplementing) {
    console.log('Implement deleteTempFiles()!!!!');
    console.log('Implement deleteTempFiles()!!!!');
    console.log('Implement deleteTempFiles()!!!!');
    console.log('Implement deleteTempFiles()!!!!');
    process.exit();
  }
}

export async function main() {
  let skip = false;
  if (skip) {
    return;
  }
  getUrls();
  config.workspaceDir = await detectWorkspaceDir();
  config.frontendFramework = await detectProjectType(config);

  const { testingFramework, testExtension } = await detectTestFramework(config);
  config.testExtension = testExtension;
  config.testingFramework = testingFramework;

  await detectTsconfigTarget();
  await detectTypescriptExtension();
  debug('#################################################', true);
  debug('##### Generating unit tests with DeepUnitAI #####', true);
  debug('#################################################', true);

  let changedFiles: string[];
  if (allFiles) {
    changedFiles = findFiles(
      [typescriptExtension, '.html'],
      ['.spec.ts', '.test.tsx', '.test.ts', '.consts.ts', '.module.ts'],
    );
  } else {
    changedFiles = getChangedFiles();
  }
  console.log(changedFiles);
  const filteredChangedFiles = filterFiles(changedFiles);
  console.log(filteredChangedFiles);
  const filesByDirectory = groupFilesByDirectory(filteredChangedFiles);

  let failingTests: string[] = [];
  let testsWithErrors: string[] = [];
  let testContentWithErrors: any[] = [];
  let passingTests: string[] = [];
  let testRunResults: string[] = []; //todo: this is never assigned, we need to fix that so the summary is correct
  let apiErrors: string[] = [];
  let firstRun = true;

  for (const directory in filesByDirectory) {
    let filesInDirectory = filesByDirectory[directory];
    while (filesInDirectory.length > 0) {
      const file = filesInDirectory.pop();
      if (file === undefined) {
        continue;
      }
      console.log('##### file: ' + file);
      const testFile = getTestName(file);
      console.log('##### testname: ' + testFile);

      if (firstRun && config.frontendFramework === 'angular') {
        checkIfAngularTestsPass(testFile);
        firstRun = false;
      }

      console.log('check the file exists');
      if (!fs.existsSync(testFile)) {
        console.log('the file not exist');
        createFile(testFile);
      } else if (
        config.frontendFramework !== 'angular' &&
        !onlyTestFixErrors &&
        false
      ) {
        console.log('not exist is angular');
        const doesTestPass = checkIfJestTestPasses(testFile);
        console.log('doesTestPass');
        console.log(doesTestPass);
        if (!doesTestPass) {
          failingTests.push(testFile);
          continue;
        }
      } else {
        console.log('not exist not angular');
      }
      console.log('The test did not fail, continuing to generate');

      const testVersion = getTestVersion(testFile);
      const [tsFile, htmlFile, correspondingFile] = tsAndHtmlFromFile(
        file,
        filesInDirectory,
      );

      if (correspondingFile && filesInDirectory.includes(correspondingFile)) {
        const index = filesInDirectory.indexOf(correspondingFile);
        if (index > -1) {
          filesInDirectory.splice(index, 1);
        }
      }
      let filesToPass = [];
      if (tsFile) {
        filesToPass.push(tsFile);
      }
      if (htmlFile) {
        filesToPass.push(htmlFile);
      }
      const diff = getDiff(filesToPass);
      let tsFileContent: string = getFileContent(tsFile);
      const htmlFileContent = getFileContent(htmlFile);
      //todo: implement truncation which works, this should probably be in the backend
      /* hopefully we can not truncate now
            if(tsFileContent?.length>1500) {
                tsFileContent = tsFileContent?.substring(0, 1500)
            }*/
      //console.log(tsFileContent)
      console.log('tsFile: ' + tsFile);

      let tempTestPaths: string[] = [];
      if (!onlyTestFixErrors) {
        const response = await generateTest(
          diff,
          tsFile,
          tsFileContent,
          htmlFile,
          htmlFileContent,
          testFile,
          testVersion,
        );
        console.log(response);
        let tests;
        if (!response) {
          apiErrors.push(testFile);
          continue;
        }
        try {
          const tests = response.tests;
          // todo: fix the issue with which files  so we can
          tempTestPaths = writeTestsToFiles(tests, false);
        } catch (error) {
          console.error('Caught error trying to writeTestsToFiles');
          console.error(error);
          console.error(response);
          apiErrors.push(testFile);
        }
      }

      const { fixedAllErrors, runResults, apiError } = await fixManyErrors(
        tempTestPaths,
        diff,
        tsFile,
        tsFileContent,
      );
      //We will need to recombine all the tests into one file here after they are fixed and remove any failing tests
      recombineTests(true);
      //then we will need to delete all the temp test files.
      deleteTempFiles(tempTestPaths, true);
      //Todo: update the sumary accordingly
      if (apiError) {
        console.log('API error encountered');
        apiErrors.push(testFile);
        continue;
      }

      testRunResults.push(`\n     Result for: ${testFile}`);
      testRunResults.push(runResults);
      if (fixedAllErrors) {
        passingTests.push(testFile);
      } else {
        testsWithErrors.push(testFile);
        if (config.frontendFramework === 'angular') {
          // This makes no sense, so I removed the saveFailingTests function, lets fiure it out when we restore angular support testContentWithErrors.push({ test: testFile, testContent: fixedTest });
        }
      }
    }
  }
  console.log('Completed the first loop');

  printSummary(
    failingTests,
    testsWithErrors,
    passingTests,
    apiErrors,
    testRunResults,
  );

  console.log('Need help? Email justin@deepunit.ai');
  process.exit(100);

  console.log('Remove the exit');
}

if (require.main === module) {
  main();
}
