#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { LoadingIndicator, exitWithError, getFilesFlag, isEmpty, setupYargs, validateVersionIsUpToDate } from './lib/utils';
import { Printer } from './lib/Printer';
import { Tester } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';
import { Api, ClientCode, StateCode } from './lib/Api';
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

  const prettierConfig: Object | undefined = Files.getPrettierConfig();

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
        continue;
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
      const response = await tester.generateTest(sourceFileDiff, sourceFileName, sourceFileContent, testFileName, testFileContent);
      if (response.stateCode === StateCode.FileNotSupported) {
        unsupportedFiles.push(sourceFileName);
        continue;
      } else if (response.stateCode === StateCode.FileFullyTested) {
        alreadyTestedFiles.push(sourceFileName);
        continue;
      } else if (response.stateCode === StateCode.Success) {
        if (!response?.tests || isEmpty(response.tests)) {
          serverDidNotSendTests.push(sourceFileName);
          console.error(`We did not receive a response from the server to generate a test for ${sourceFileName}. This should never happen`);
          continue;
        }
        // if we are then we are good to go, keep processing test
      } else {
        console.log(CONFIG.isDevBuild ? 'Invalid stateCode received from the backend' : 'DeepUnit is out of date, please run "npm install deepunit@latest --save-dev"');
        continue;
      }

      let tests: Record<string, string> = response.tests;
      // Write the temporary test files, so we can test the generated tests
      let tempTestPaths: string[] = Files.writeTestsToFiles(tests);

      let { failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount } = await tester.getTestResults(tempTestPaths);
      const retryFunctions: string[] = [];

      // determine which tests have a successRatio below 0.5
      for (const testPath of tempTestPaths) {
        let successRatio = 1;
        if (failedItBlocks[testPath]) {
          successRatio = failedItBlocks[testPath].length / itBlocksCount[testPath];
        }
        if (failedTests.includes(testPath)) {
          successRatio = 0;
        }

        if (successRatio <= 0.5) {
          // get the function name so we can pass it to the backend.
          const testPathChunks = testPath.split('.');
          const funcName = testPathChunks.length >= 4 ? testPathChunks[testPathChunks.length - 4] : undefined;
          // if we don't have a funcName then something is really wrong, just move on.
          if (!funcName) {
            continue;
          }

          retryFunctions.push(funcName);
        }
      }

      // retry functions that failed
      if (retryFunctions && CONFIG.retryTestGenerationOnFailure) {
        console.log(`Retrying ${retryFunctions.length} functions in a test that failed`);
        const retryFunctionsResponse = await tester.generateTest(sourceFileDiff, sourceFileName, sourceFileContent, testFileName, testFileContent, retryFunctions);
        if ((retryFunctionsResponse.stateCode === StateCode.Success && retryFunctionsResponse?.tests) || !isEmpty(retryFunctionsResponse.tests)) {
          //Re-Write these files
          Files.writeTestsToFiles(retryFunctionsResponse.tests);
        }
      }

      // retest everything, that way we have a better knowledge of what succeeded.
      ({ failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount } = await tester.getTestResults(tempTestPaths));

      Api.sendResults(failedTests, passedTests, tests, failedTestErrors);

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
    }
  }

  Printer.printSummary(testsWithErrors, passingTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles);
  process.exit(0);
}

if (require.main === module) {
  main();

  process.on('SIGINT', async function () {
    await Api.sendAnalytics('Client Exited: User quit process', ClientCode.ClientExited);
    process.exit();
  });
}
