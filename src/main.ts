#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { Config } from './lib/Config';
import { Files } from './lib/Files';
import { exitWithError, getFilesFlag, isEmpty, validateVersionIsUpToDate } from './lib/utils';
import { Printer } from './lib/Printer';
import { Tester } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';
import { Api, StateCode } from './lib/Api';
import { Auth } from './lib/Auth';
import { execSync } from 'child_process';

// global classes
export const CONFIG = new Config();
export let AUTH: Auth;

export async function main() {
  Printer.printIntro();

  // setup the auth channel and see if they are logged in or not
  AUTH = await Auth.init();

  // confirm we have all packages for type of project
  await CONFIG.confirmAllPackagesNeeded();

  // check to confirm we still support this version
  await validateVersionIsUpToDate();

  // Get files that need to be tested
  let filesToWriteTestsFor: string[];
  const filesFlagArray: string[] = getFilesFlag();
  if (filesFlagArray.length > 0) {
    console.log('Finding files within --file flag');
    filesFlagArray.forEach((filePath) => {
      if (!Files.existsSync(filePath)) {
        exitWithError(`${filePath} could not be found.`);
      }
    });
    filesToWriteTestsFor = filesFlagArray;
  } else if (CONFIG.generateAllFiles || !CONFIG.isGitRepository) {
    console.log('Finding all eligible files in working directory');
    // TODO: add a regex to filter what extensions we accept
    filesToWriteTestsFor = Files.findFiles();
  } else {
    console.log('Finding all changed files between current and HEAD branch.');
    filesToWriteTestsFor = Files.getChangedFiles();
  }

  // if we didn't get any files, return error
  if (filesToWriteTestsFor.length <= 0) {
    return exitWithError(`No files to test were found. Check your config is set right or you are using the --file flag correctly.`);
  }

  Printer.printFilesToTest(filesToWriteTestsFor);
  const filesByDirectory = Files.groupFilesByDirectory(filesToWriteTestsFor);

  let testsWithErrors: string[] = [];
  let passingTests: string[] = [];
  let unsupportedFiles: (string | null)[] = [];
  let alreadyTestedFiles: (string | null)[] = [];
  let serverDidNotSendTests: (string | null)[] = [];
  for (const directory in filesByDirectory) {
    let filesInDirectory = filesByDirectory[directory];
    while (filesInDirectory.length > 0) {
      const sourceFileName = filesInDirectory.pop();
      if (sourceFileName === undefined) {
        break;
      }

      const testFileName = Tester.getTestName(sourceFileName);

      let tester: Tester;
      if (CONFIG.testingFramework === TestingFrameworks.jest) {
        tester = new JestTester();
      } else {
        return exitWithError(`Unable to run DeepUnit.AI, ${CONFIG.testingFramework} is not a supported testing framework. Please read the documentation for more details.`);
      }

      let testFileContent: string = '';
      if (Files.existsSync(testFileName)) {
        const result: string | null = Files.getExistingTestContent(testFileName);
        if (testFileContent === null) {
          continue;
        } else {
          testFileContent = result as string;
        }
      }

      let sourceFileDiff = '';
      if (!CONFIG.generateAllFiles && CONFIG.isGitRepository) {
        sourceFileDiff = Files.getDiff([sourceFileName]);
      }
      const sourceFileContent = Files.getFileContent(sourceFileName);

      console.log(`Generating test for ${sourceFileName}`);

      const response = await tester.generateTest(sourceFileDiff, sourceFileName, sourceFileContent, testFileName, testFileContent);
      if (response.stateCode === StateCode.FileNotSupported) {
        unsupportedFiles.push(sourceFileName);
      } else if (response.stateCode === StateCode.FileFullyTested) {
        alreadyTestedFiles.push(sourceFileName);
      } else if (response.stateCode === StateCode.Success) {
        if (!response?.tests || isEmpty(response.tests)) {
          serverDidNotSendTests.push(sourceFileName);
          console.error(`We did not receive a response from the server to generate a test for ${sourceFileName}. This should never happen`);
          continue;
        }
        let tests: Record<string, string> = response.tests;
        // Write the temporary test files, so we can test the generated tests
        let tempTestPaths: string[] = Files.writeTestsToFiles(tests);

        // REMOVED for RELEASE
        // const { hasPassingTests, passedTests, failedTests }: FixManyErrorsResult = await tester.fixManyErrors(tempTestPaths, sourceFileDiff, sourceFileName, sourceFileContent);

        const { failedTests, passedTests, failedTestErrors } = tester.getTestResults(tempTestPaths);
        Api.sendResults(failedTests, passedTests, tests, failedTestErrors);

        //We will need to recombine all the tests into one file here after they are fixed and remove any failing tests
        const prettierConfig: Object | undefined = Files.getPrettierConfig();
        let testsToKeep: string[] = CONFIG.includeFailingTests ? tempTestPaths : passedTests;
        await tester.recombineTests(testsToKeep, testFileName, testFileContent, passedTests.length > 0, prettierConfig);

        //then we will need to delete all the temp test files.
        Files.deleteTempFiles(tempTestPaths);

        if (passedTests.length > 0) {
          if (CONFIG.includeFailingTests && failedTests.length > 0) {
            testsWithErrors.push(testFileName);
          } else {
            passingTests.push(testFileName);
          }
        } else {
          testsWithErrors.push(testFileName);
        }
      } else {
        console.log(CONFIG.isDevBuild ? 'Invalid stateCode received from the backend' : 'DeepUnit is out of date, please run "npm install deepunit@latest --save-dev"');
      }
    }
  }

  Printer.printSummary(testsWithErrors, passingTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles);
  process.exit(100);
}

main();
