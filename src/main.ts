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
  console.log('console.log: filesByDirectory');
  console.log(filesByDirectory);

  // break code execution into different paths depending on which user flag
  if (flagType != 'bugFlag' && flagType != 'bugFileFlag') {
    console.log('error1');
    let testsWithErrors: string[] = [];
    let passingTests: string[] = [];
    let unsupportedFiles: (string | null)[] = [];
    let alreadyTestedFiles: (string | null)[] = [];
    let serverDidNotSendTests: (string | null)[] = [];


    for (const directory in filesByDirectory) {
      let filesInDirectory = filesByDirectory[directory];
      console.log(filesInDirectory);
      while (filesInDirectory.length > 0) {
        const sourceFileName = filesInDirectory.pop();
        if (sourceFileName === undefined) {
          continue;
        }

        const testFileName = Tester.getTestName(sourceFileName);

        let tester: Tester;

        //check jest config
        if (CONFIG.testingFramework === TestingFrameworks.jest) {
          tester = new JestTester();
        } else {
          return await exitWithError(`Unable failed to detect Jest config. If this repo has Jest installed set "testingFramework": "jest" in deepunit.config.json`);
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


        // Create object based on testInput interface to pass into GenerateTest
        let testInput: GenerateTestOrReportInput = { sourceFileDiff, sourceFileName, sourceFileContent, generatedFileName: testFileName, generatedFileContent: testFileContent};



        //Calls openAI to generate model response
        const response = await tester.generateTest(testInput);
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

        // get data to pass to backend
        let promptInputRecord: Record<string, string> = response.promptInputRecord;
        let modelTextResponseRecord: Record<string, string> = response.modelTextResponseRecord;

        // if we are then we are good to go, keep processing test
        let tests: Record<string, string> = response.tests;
        // Write the temporary test files, so we can test the generated tests
        let tempTestPaths: string[] = Files.writeTestsToFiles(tests);

        //Get the testresults
        let testResults: TestRunResult = await tester.getTestResults(tempTestPaths);
        let { failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount } = testResults;

        // get failed functions to retry
        const retryFunctions: string[] = Tester.getRetryFunctions(testResults, tempTestPaths);

        //modify testInput object to retry only for functions that failed
        testInput.functionsToTest = retryFunctions;

        // retry functions that failed
        if (retryFunctions && CONFIG.retryTestGenerationOnFailure) {
          console.log(`Retrying ${retryFunctions.length} functions in a test that failed`);
          const retryFunctionsResponse = await tester.generateTest(testInput);
          if ((retryFunctionsResponse.stateCode === StateCode.Success && retryFunctionsResponse?.tests) || !isEmpty(retryFunctionsResponse.tests)) {
            //Re-Write these files
            Files.writeTestsToFiles(retryFunctionsResponse.tests);
            tests = { ...tests, ...retryFunctionsResponse.tests };
          }
        }

        // run the regenerated test code (try to compile it for user) to get results whether pass/file
        ({ failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount } = await tester.getTestResults(tempTestPaths));

        Api.sendResults(failedTests, passedTests, tests, failedTestErrors, sourceFileName, sourceFileContent,promptInputRecord,
        modelTextResponseRecord);
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
    Printer.printOutro();
    if (filesToTest.length === 0) {
      console.log('We found no files to test. For complete documentation visit https://deepunit.ai/docs');
    }
    await Log.getInstance().sendLogs();
    process.exit(0);
  }
  else if (flagType == 'bugFlag' || flagType == 'bugFileFlag') {
    console.log('noterrorhere');
    console.log('console.log: filesByDirectory');
    console.log(filesByDirectory);
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
        let bugReportInput: GenerateTestOrReportInput = { sourceFileDiff, sourceFileName, sourceFileContent, generatedFileName: bugReportName, generatedFileContent: bugReportContent};
        const response = await tester.generateBugReport(bugReportInput);

        let testCasesObj = response.testCasesObj;

        if(flagType == 'bugFileFlag')
        {
          console.log('doesitregister');

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

                    //check jest config
                    if (CONFIG.testingFramework === TestingFrameworks.jest) {
                        tester = new JestTester();
                    } else {
                        return await exitWithError(`Unable failed to detect Jest config. If this repo has Jest installed set "testingFramework": "jest" in deepunit.config.json`);
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


                    // Create object based on testInput interface to pass into GenerateTest
                    // Kate look here: should pass in functions
                    let testInput: GenerateTestOrReportInput = { sourceFileDiff, sourceFileName, sourceFileContent, generatedFileName: testFileName, generatedFileContent: testFileContent, testCasesObj:testCasesObj};
                    console.log('console.log: testInput');
                    console.log(testInput);


                    //Calls openAI to generate model response
                    const response = await tester.generateTest(testInput);
                    console.log('testGeneration response');
                    console.log(response);
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

                    // get data to pass to backend
                    let promptInputRecord: Record<string, string> = response.promptInputRecord;
                    let modelTextResponseRecord: Record<string, string> = response.modelTextResponseRecord;

                    // if we are then we are good to go, keep processing test
                    let tests: Record<string, string> = response.tests;
                    // Write the temporary test files, so we can test the generated tests
                    let tempTestPaths: string[] = Files.writeTestsToFiles(tests);

                    //Get the testresults
                    let testResults: TestRunResult = await tester.getTestResults(tempTestPaths);
                    let { failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount } = testResults;

                    // get failed functions to retry
                    const retryFunctions: string[] = Tester.getRetryFunctions(testResults, tempTestPaths);

                    //modify testInput object to retry only for functions that failed
                    testInput.functionsToTest = retryFunctions;

                    // retry functions that failed
                    if (retryFunctions && CONFIG.retryTestGenerationOnFailure) {
                        console.log(`Retrying ${retryFunctions.length} functions in a test that failed`);
                        const retryFunctionsResponse = await tester.generateTest(testInput);
                        if ((retryFunctionsResponse.stateCode === StateCode.Success && retryFunctionsResponse?.tests) || !isEmpty(retryFunctionsResponse.tests)) {
                            //Re-Write these files
                            Files.writeTestsToFiles(retryFunctionsResponse.tests);
                            tests = { ...tests, ...retryFunctionsResponse.tests };
                        }
                    }

                    // run the regenerated test code (try to compile it for user) to get results whether pass/file
                    ({ failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount } = await tester.getTestResults(tempTestPaths));

                    Api.sendResults(failedTests, passedTests, tests, failedTestErrors, sourceFileName, sourceFileContent,promptInputRecord,
                        modelTextResponseRecord);
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
            Printer.printOutro();
            if (filesToTest.length === 0) {
                console.log('We found no files to test. For complete documentation visit https://deepunit.ai/docs');
            }
            await Log.getInstance().sendLogs();
            process.exit(0);


          //response.testCasesObj

        }

        //Api.sendBugResults(response, bugReportName, sourceFileName, sourceFileContent);
      }
    }
  }
}
if (require.main === module) {
  main();

  process.on('SIGINT', async function () {
    await Api.sendAnalytics('Client Exited: User quit process', ClientCode.ClientExited);
    await Log.getInstance().sendLogs();
    process.exit();
  });
}
