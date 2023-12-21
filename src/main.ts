#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { checkFeedbackFlag, exitWithError, getBugFlag, getFilesFlag, isEmpty, promptUserInput, setupYargs, validateVersionIsUpToDate } from './lib/utils';
import { Color, Printer } from './lib/Printer';
import { Tester, TestRunResult, GenerateTestOrReportInput } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';
import { Api, ClientCode, StateCode } from './lib/Api';
import { Auth } from './lib/Auth';
import { Log } from './lib/Log';

// global classes

export let AUTH: Auth;

export async function main() {
  setupYargs();

  Printer.printIntro();

  if (process.platform === 'win32') {
    return await exitWithError(
      Color.red(
        'We do not support windows yet, although we do support using deepunit through WSL on windows(https://learn.microsoft.com/en-us/windows/wsl/install). If you would like us to support windows please email us.',
      ),
    );
  }

  // setup the auth channel and see if they are logged in or not
  AUTH = await Auth.init();

  // check to confirm we still support this version
  await validateVersionIsUpToDate();

  Files.setup();

  let testCasesObj;

  // confirm we have all packages for type of project
  await CONFIG.confirmAllPackagesNeeded();

  // check to confirm we still support this version
  if (checkFeedbackFlag()) {
    const feedback = await promptUserInput(
      'We love feedback. Let us know of suggestions, bugs, issues, or problems so we can make DeepUnit better: ',
      'Thank you for your feedback!',
    );
    const subject: string = '--feedback';
    await Api.Feedback(feedback, subject);
    process.exit(0);
  }

  const prettierConfig: Object | undefined = Files.getPrettierConfig();

  // Get files that need to be tested
  const filesToTestResult = await Files.getFilesToTest();
  const filesToTest = filesToTestResult.filesFlagReturn.readyFilesToTest ?? [];
  const flagType = filesToTestResult.filesFlagReturn.flagType ?? '';

  Printer.printFilesToTest(filesToTest);

  const filesByDirectory = Files.groupFilesByDirectory(filesToTest);

  // break code execution into different paths depending on which user flag
  //bug report goes first (anything not test generation goes first)
  if (flagType == 'bugFlag' || flagType == 'bugFileFlag') {
    const filesByDirectory = Files.groupFilesByDirectory(filesToTest);
    for (const directory in filesByDirectory) {
      let filesInDirectory = filesByDirectory[directory];
      while (filesInDirectory.length > 0) {
        const sourceFileName = filesInDirectory.pop();
        if (sourceFileName === undefined) {
          continue;
        }

        const bugReportName = Tester.getBugReportName(sourceFileName);

        let tester: Tester;
        tester = new JestTester();

        let bugReportContent: string = '';
        if (Files.existsSync(bugReportName)) {
          const result: string | null = Files.getExistingTestContent(bugReportName);
          if (bugReportContent === null) {
            continue;
          } else {
            bugReportContent = result as string;
          }
        }

        let sourceFileDiff = '';
        const files = getBugFlag() ?? [];
        const sourceFileContent = Files.getFileContent(sourceFileName);

        let bugReportInput: GenerateTestOrReportInput = {
          sourceFileDiff,
          sourceFileName,
          sourceFileContent,
          generatedFileName: bugReportName,
          generatedFileContent: bugReportContent
        };
        const response = await tester.generateBugReport(bugReportInput);

        testCasesObj = response.testCasesObj;

      }
    }

  }
  if (flagType != 'bugFlag') {
    //this is for retry
    let testsWithErrors: string[] = [];

    //this is also for retry
    let passingTests: string[] = [];

    //files where we were not able to parse out functions (enabled by statecode message passback)
    let unsupportedFiles: (string | null)[] = [];

    //files already tested (enabled by statecode message passback)
    let alreadyTestedFiles: (string | null)[] = [];

    //files that that get parsed successfully but for some reason tests were not generated
    let serverDidNotSendTests: (string | null)[] = [];


    //files by Directory is a record of <directory,files>
    //we are looping through each file in each directory
    for (const directory in filesByDirectory) {
      let filesInDirectory = filesByDirectory[directory];

      //while there are still files in the directory, we remove them from the filesindirectory array
      //and do the whole generatetest process for it in this giant while loop lol
      while (filesInDirectory.length > 0) {
        const sourceFileName = filesInDirectory.pop();
        if (sourceFileName === undefined) {
          continue;
        }

        const testFileName = Tester.getTestName(sourceFileName);



        let tester: Tester;
        //check jest config
        //ky note: wouldn't config for testingFramework be at project level
        if (CONFIG.testingFramework === TestingFrameworks.jest) {
          tester = new JestTester();
        } else {
          return await exitWithError(`Unable failed to detect Jest config. If this repo has Jest installed set "testingFramework": "jest" in deepunit.config.json`);
        }

        let testFileContent: string = '';
        console.log(`result of: ${Files.existsSync(testFileName)}`);
        console.log(testFileName);
        if (Files.existsSync(testFileName)) {
          const result: string | null = Files.getExistingTestContent(testFileName);
          if (testFileContent === null) {
            continue;
          } else {
            testFileContent = result as string;
          }
        }
        console.log(testFileContent);

        let sourceFileDiff = '';
        const files = getFilesFlag() ?? [];
        if (!CONFIG.generateAllFiles && files.length <= 0 && CONFIG.isGitRepository) {
          sourceFileDiff = Files.getDiff([sourceFileName]);
        }
        const sourceFileContent = Files.getFileContent(sourceFileName);


        let testInput: GenerateTestOrReportInput;
        // Create object based on testInput interface to pass into GenerateTest
        if (testCasesObj) {
          testInput = { sourceFileDiff, sourceFileName, sourceFileContent, generatedFileName: testFileName, generatedFileContent: testFileContent, testCasesObj: testCasesObj };
        } else {
          testInput = { sourceFileDiff, sourceFileName, sourceFileContent, generatedFileName: testFileName, generatedFileContent: testFileContent };
        }

        //Calls openAI to generate model response
        const response = await tester.generateTest(testInput);

        //this could get abstracted away
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
          // else we successfully got a test back from the server, now we should test them
        } else {
          console.log(CONFIG.isDevBuild ? 'Invalid stateCode received from the backend' : 'DeepUnit is out of date, please run "npm install deepunit@latest --save-dev"');
          continue;
        }

        const filePathChunk = directory + '/';

        // if we are then we are good to go, keep processing test
        let tests: { [key: string]: string } = response.tests;
        // Write the temporary test files, so we can test the generated tests
        let firstGenTempTestNames: string[] = Files.writeTestsToFiles(tests, filePathChunk);

        //Get the testresults
        let firstTestResults: TestRunResult = await tester.getTestResults(firstGenTempTestNames);
        let { failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount } = firstTestResults;

        // get failed functions to retry
        const retryFunctions: string[] = Tester.getRetryFunctions(firstTestResults, firstGenTempTestNames);

        //modify testInput object to retry only for functions that failed
        testInput.functionsToTest = retryFunctions;

        // retry functions that failed
        let retryFunctionsResponse: any = {};
        let retryTempTestNames: string [] = [];
        if (retryFunctions && CONFIG.retryTestGenerationOnFailure) {
          console.log(`Retrying ${retryFunctions.length} functions in a test that failed`);
          retryFunctionsResponse = await tester.generateTest(testInput);
          if ((retryFunctionsResponse.stateCode === StateCode.Success && retryFunctionsResponse?.tests) || !isEmpty(retryFunctionsResponse.tests)) {
            //Re-Write these files
            retryTempTestNames = Files.writeTestsToFiles(retryFunctionsResponse.tests, filePathChunk);
          }
        }


        // run the regenerated test code (try to compile it for user) to get results whether pass/file
        let retryTestResults: TestRunResult = await tester.getTestResults(firstGenTempTestNames);
        // if statement for including failing tests;
        let recombineTests: { [key: string]: string } = {};
        if(CONFIG.includeFailingTests){
          tests = {...firstTestResults.passedTests, ...retryTestResults.passedTests, ...retryTestResults.failedTests};
          passedTests = {...firstTestResults.passedTests, ...retryTestResults.passedTests};
        } else if (!CONFIG.includeFailingTests) {
          tests = {...firstTestResults.passedTests, ...retryTestResults.passedTests};
          passedTests = {...firstTestResults.passedTests, ...retryTestResults.passedTests};
        }
        for (const testPath in retryFunctionsResponse) {
          if (testPath in tests) {
            recombineTests[testPath] = retryFunctionsResponse.tests[testPath] as string;
          }
        }
        for(const testPath in response.tests) {
          if (testPath in tests) {
            recombineTests[testPath] = response.tests[testPath];
          }
        }




        Api.sendResults(retryTestResults.failedTests, passedTests, tests, failedTestErrors, sourceFileName, sourceFileContent);
        await tester.recombineTests(recombineTests, testFileName, testFileContent, retryTestResults.failedTests, failedItBlocks, prettierConfig);

        //get test path
        const finalTempTestNames = firstGenTempTestNames.concat(retryTempTestNames);
        const finalTempTestPaths = finalTempTestNames.map(testName => {
          return filePathChunk + testName;
        });


        //then we will need to delete all the temp test files.
        Files.deleteTempFiles(finalTempTestPaths);

        if (Object.keys(passedTests).length > 0) {
          if (CONFIG.includeFailingTests && Object.keys(failedTests).length > 0) {
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
    Printer.printOutro();
    if (filesToTest.length === 0) {
      console.log('We found no files to test. For complete documentation visit https://deepunit.ai/docs');
    }
    await Log.getInstance().sendLogs();
    process.exit(0);
  }
}


if (require.main === module) {
  main();

  process.on('SIGINT', async function() {
    await Api.sendAnalytics('Client Exited: User quit process', ClientCode.ClientExited);
    await Log.getInstance().sendLogs();
    process.exit();
  });

}
