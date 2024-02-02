#!/usr/bin/env node

import {TestingFrameworks} from './main.consts';
import {CONFIG} from './lib/Config';
import {Files} from './lib/Files';
import {checkFeedbackFlag, exitWithError, getBugFlag, getFilesFlag, getJsonFlag, getMetaFlag, isEmpty, promptUserInput, setupYargs, validateVersionIsUpToDate} from './lib/utils';
import {Color, Printer} from './lib/Printer';
import {GenerateTestOrReportInput, Tester, TestRunResult} from './lib/testers/Tester';
import {JestTester} from './lib/testers/JestTester';
import {Api, ClientCode, StateCode} from './lib/Api';
import {Auth} from './lib/Auth';
import {Log} from './lib/Log';
import fs from "fs";
import path from 'path';
import {JasmineTester} from "./lib/testers/JasmineTester";

// global classes
export let AUTH: Auth;

if (require.main === module) {
  main();

  process.on('SIGINT', async function () {
    await Api.sendAnalytics('Client Exited: User quit process', ClientCode.ClientExited);
    await Log.getInstance().sendLogs();
    process.exit();
  });
}

export async function setUp() {
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

  //set up config
  Files.setup();

  if(CONFIG.testingFramework === TestingFrameworks.jest) {
    // confirm we have all packages for type of project
    // is where we code in react18 dependency
    await CONFIG.confirmAllPackagesNeeded();
  }


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
}

export function getTesterType() {
  let testerType;
  if (CONFIG.testingFramework === TestingFrameworks.jest) {
    // Directly use JestTester if available globally or require it at the top if not
    testerType = 'jest'
  } else if (CONFIG.testingFramework === TestingFrameworks.jasmine) {
    // Dynamic import for JasmineTester to handle circular dependency issues
    let { JasmineTester } = require("./lib/testers/JasmineTester");
    testerType = 'jasmine'
    //tester = new JasmineTester();
  } else {
    // Handle error for unsupported or undefined testing framework
    throw new Error(`Unable to detect a testing config. If this repo has Jasmine or Jest installed set "testingFramework": "jasmine" in deepunit.config.json`);
  }
  return testerType; // Return the created tester instance
}

export async function main() {
  await setUp();
  let testerType = await getTesterType();
  const filesToTestResult = await Files.getFilesToTest();
  const filesToTest = filesToTestResult.filesFlagReturn.readyFilesToTest ?? [];
  if (filesToTest.length === 0) {
    console.log('We found no files to test. For complete documentation visit https://deepunit.ai/docs');
  }
  const flagType = filesToTestResult.filesFlagReturn.flagType ?? '';

  for (const fileToTest of filesToTest) {

    let sourceFileName = fileToTest;

    const testFileName = Tester.getTestName(sourceFileName);
    const testFileContent = getTestContent(testFileName);
    const sourceFileContent = Files.getFileContent(sourceFileName);
    const prettierConfig: Object | undefined = Files.getPrettierConfig();
    if (flagType == 'bugFlag' || flagType == 'bugFileFlag') {
      await mainBugReportGeneration(testerType, sourceFileName, sourceFileContent, testFileContent);
    }

    if (flagType != 'bugFlag') {
      await generateTestFlow(sourceFileName, sourceFileContent, testFileName, testFileContent, testerType, prettierConfig)
    }
  }
}


export async function generateTestFlow(sourceFileName, sourceFileContent, testFileName, testFileContent, testerType, prettierConfig, lastTestResults?, testCasesObj?) {
  let tester;
  if (testerType === 'jest') {
    tester = new JestTester()
  } else if (testerType === 'jasmine') {
    tester = new JasmineTester()
  }

  let tests: { [key: string]: string } = {};
  const firstTestResponse = await mainGenerateTest(sourceFileName, sourceFileContent, testFileName, testFileContent, testerType);
  let testPaths = firstTestResponse.testPaths;
  const firstTestResults = await tester.getTestResults(testPaths)
  tests = firstTestResponse.tests;

  deleteTempTestsAndSendResults( testFileName, firstTestResults, firstTestResponse, tests, sourceFileName, sourceFileContent)
}

export async function mainGenerateTest(sourceFileName, sourceFileContent, testFileName, testFileContent, testerType, lastTestResults?, testCasesObj?):Promise<{tests, testPaths, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles}> {
  let tester;
  if (testerType === 'jest') {
    tester = new JestTester()
  } else if (testerType === 'jasmine') {
    tester = new JasmineTester()
  }
  let unsupportedFiles: (string | null)[] = [];
  //files already tested (enabled by statecode message passback)
  let alreadyTestedFiles: (string | null)[] = [];
  //files that that get parsed successfully but for some reason tests were not generated
  let serverDidNotSendTests: (string | null)[] = [];

  let sourceFileDiff = [];
  const files = getFilesFlag() ?? [];
  if (!CONFIG.generateAllFiles && CONFIG.isGitRepository) {
    //If they are generating all files then the diff would not be relevant, however if they are not then we want to make sure to include the diff so that we can filter to only functions they have changed
    await CONFIG.askForDefaultBranch();
    sourceFileDiff = await Files.getDiff([sourceFileName]);
  }

  let testInput: GenerateTestOrReportInput;
  // Create object based on testInput interface to pass into GenerateTest

  testInput = { sourceFileDiff, sourceFileName, sourceFileContent, generatedFileName: testFileName, generatedFileContent: testFileContent };
  if (testCasesObj) {
    testInput.testCasesObj = testCasesObj;
  } else if (lastTestResults) {
    //note to justin: probably where we would put put some fix test flow stuff
  }

  //Calls openAI to generate model response
  const response = await tester.generateTest(testInput);
  //fs.writeFileSync(testInput.sourceFileName + '.md', response.md)
  //this could get abstracted away
  if (response.stateCode === StateCode.FileNotSupported) {
    unsupportedFiles.push(sourceFileName);
    return undefined;
  } else if (response.stateCode === StateCode.FileFullyTested) {
    alreadyTestedFiles.push(sourceFileName);
    return undefined;
  } else if (response.stateCode === StateCode.Success) {
    if (!response?.tests || isEmpty(response.tests)) {
      serverDidNotSendTests.push(sourceFileName);
      console.error(`We did not receive a response from the server to generate a test for ${sourceFileName}. This should never happen`);
      return undefined;
    }
    // else we successfully got a test back from the server, now we should test them
  } else {
    console.log(CONFIG.isDevBuild ? 'Invalid stateCode received from the backend' : 'DeepUnit is out of date, please run "npm install deepunit@latest --save-dev"');
    return undefined;
  }

  const filePathChunk = path.dirname(sourceFileName) + '/';

  let tests: { [key: string]: string } = response.tests;
  // Write the temporary test files, so we can test the generated tests
  let testPaths: string[] = Files.writeTestsToFiles(tests, filePathChunk);

  return {tests, testPaths, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles};

}

export async function mainBugReportGeneration(tester, sourceFileName, sourceFileContent, bugReportContent){
    let testCasesObj;

    const bugReportName = Tester.getBugReportName(sourceFileName);

    let sourceFileDiff: string[] = [];

    let bugReportInput: GenerateTestOrReportInput = {
      sourceFileDiff,
      sourceFileName,
      sourceFileContent,
      generatedFileName: bugReportName,
      generatedFileContent: bugReportContent,
    };
    const response = await tester.generateBugReport(bugReportInput);

    testCasesObj = response.testCasesObj;
}


export async function deleteTempTestsAndSendResults(testFileName, firstTestResults, firstTestResponse, tests, sourceFileName, sourceFileContent){
  let {passedTests, failedTests, failedTestErrors, failedItBlocks, itBlocksCount } = firstTestResults;
  let serverDidNotSendTests = firstTestResponse.serverDidNotSendTests
  let alreadyTestedFiles = firstTestResponse.alreadyTestedFiles
  let unsupportedFiles = firstTestResponse.unsupportedFiles
  let finalTempTestNames =
    [...Object.keys(firstTestResults.passedTests),
      ...Object.keys(firstTestResults.failedTests)];
  //Final results array
  let testsWithErrors: string[] = [];
  let passingTests: string[] = [];

  let completedTestFiles: { path: string; content: string }[] = [];

  const finalTempTestPaths = finalTempTestNames.map((testName) => {
    return path.dirname(sourceFileName) + '/' + testName;
  });

  //then we will need to delete all the temp test files.
  Files.deleteTempFiles(finalTempTestPaths);

  if (Object.keys(passedTests).length > 0) {
    if (CONFIG.includeFailingTests && Object.keys(failedTests).length > 0) {
      testsWithErrors.push(testFileName);
      passingTests.push(testFileName);
    } else {
      passingTests.push(testFileName);
    }
  }

  if (getJsonFlag() && completedTestFiles.length > 0) {
    const summary = Printer.getJSONSummary(testsWithErrors, passingTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles);
    const deepunitTests: string = JSON.stringify({results: completedTestFiles, summary, meta: getMetaFlag() ?? ''}, null, 2)
    Files.writeFileSync('deepunit-tests.json', deepunitTests);
  }

  Printer.printSummary(testsWithErrors, passingTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles);
  Printer.printOutro();
  await Log.getInstance().sendLogs();
  process.exit(0);
}

export function getTestContent(testFileName){
  let testFileContent: string = '';
  if (Files.existsSync(testFileName)) {
    const result: string | null = Files.getExistingTestContent(testFileName);
    if (testFileContent === null) {
      return undefined;
    } else {
      testFileContent = result as string;
    }
  }
  return testFileContent;
}



