#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { exitWithError, getFilesFlag, isEmpty, setupYargs, validateVersionIsUpToDate } from './lib/utils';
import { Printer } from './lib/Printer';
import { Tester } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';
import { Api, StateCode } from './lib/Api';
import { Auth } from './lib/Auth';

// global classes
export let AUTH: Auth;

export async function main() {
  setupYargs();

  Printer.printIntro();

  // setup the auth channel and see if they are logged in or not
  AUTH = await Auth.init();

  // check to confirm we still support this version
  await validateVersionIsUpToDate();
  Files.setup();

  // confirm we have all packages for type of project
  await CONFIG.confirmAllPackagesNeeded();

  // Get files that need to be tested
  const filesToTest = Files.getFilesToTest();

  Printer.printFilesToTest(filesToTest);

  const filesByDirectory = Files.groupFilesByDirectory(filesToTest);

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
      const files = getFilesFlag() ?? [];
      if (!CONFIG.generateAllFiles && files.length <= 0 && CONFIG.isGitRepository) {
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

        const { failedTests, passedTests, failedTestErrors, failedItBlocks } = await tester.getTestResults(tempTestPaths);

        Api.sendResults(failedTests, passedTests, tests, failedTestErrors);

        //We will need to recombine all the tests into one file here after they are fixed and remove any failing tests
        const prettierConfig: Object | undefined = Files.getPrettierConfig();

        await tester.recombineTests(tests, testFileName, testFileContent, failedItBlocks, failedTests, prettierConfig);

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

if (require.main === module) {
  main();
}
