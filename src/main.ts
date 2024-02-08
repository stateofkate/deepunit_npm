#!/usr/bin/env node

import {TestingFrameworks} from './main.consts';
import {CONFIG} from './lib/Config';
import {Files} from './lib/Files';
import {
  checkFeedbackFlag,
  exitWithError,
  getBugFlag,
  getFilesFlag,
  getJsonFlag,
  getMetaFlag,
  isEmpty,
  LoadingIndicator,
  promptUserInput,
  setupYargs,
  validateVersionIsUpToDate
} from './lib/utils';
import {Color, Printer} from './lib/Printer';
import {GenerateTestOrReportInput, SingleTestRunResult, Tester, TestRunResult} from './lib/testers/Tester';
import {JestTester} from './lib/testers/JestTester';
import {Api, ClientCode, StateCode} from './lib/Api';
import {Auth} from './lib/Auth';
import console, {Log} from './lib/Log';
import fs from "fs";
import path from 'path';
import {JasmineTester} from "./lib/testers/JasmineTester";
export type ParsedTestCases = {caseString: string; input: string; output: string; explanation: string; type: string}
export type TestCaseWithTestBed = {code?: string, testCase: ParsedTestCases, duplicate: boolean, testBed?: string, functionName?: string;}
export type FailedTestCaseWithTestBed = {code?: string, testCase: ParsedTestCases, duplicate: boolean, testBed?: string, functionName?: string; failureStackTrace: string;}
export type GenerateJasmineResponse = { testFileArray?: TestCaseWithTestBed[]; generatedTestBed: (string | undefined); testCaseIts: FunctionToTestCaseCode[], md:string, tests?: any[]; stateCode?: StateCode; stateMessage?: string; error?: string };
export type FunctionToTestCaseCode = {
  functionName: string;
  testCases: TestCaseAndCode[]
}
export type TestCaseAndCode = {code?: string, testCase: ParsedTestCases, duplicate: boolean}

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

export function getTester() {
  if (CONFIG.testingFramework === TestingFrameworks.jest) {
    // Directly use JestTester if available globally or require it at the top if not
    return new JestTester()
  } else if (CONFIG.testingFramework === TestingFrameworks.jasmine) {
    // Dynamic import for JasmineTester to handle circular dependency issues
    let { JasmineTester } = require("./lib/testers/JasmineTester");
    return new JasmineTester()
  } else {
    // Handle error for unsupported or undefined testing framework
    throw new Error(`Unable to detect a testing config. If this repo has Jasmine or Jest installed set "testingFramework": "jasmine" in deepunit.config.json`);
  }
}

export async function main() {
  await setUp();
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
      await mainBugReportGeneration(sourceFileName, sourceFileContent, testFileContent);
    }

    if (flagType != 'bugFlag') {
      const {serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles, response} = await generateTestFlow(sourceFileName, sourceFileContent, testFileName, testFileContent, prettierConfig)
      const testResults = runGeneratedTests(response, sourceFileName)
    }
  }
}

export async function runGeneratedTests(response: GenerateJasmineResponse, sourceFileName: string): Promise<{ failedTests: FailedTestCaseWithTestBed[], passedTests: TestCaseWithTestBed[] }> {
  let tester = getTester();
  const fileParts = sourceFileName.split('.');
  const fileExt = fileParts[fileParts.length - 1];
  const tempTestName = sourceFileName + '.deepunittemptest.' + CONFIG.testSuffix  + '.' + fileExt
  let passedTests: TestCaseWithTestBed[] = [];
  let passedTestString = ''
  let failedTestString = ''
  let failedTests: FailedTestCaseWithTestBed[]= []
  //here we will go thru the tests until we find one that fails.
  //If it fails we will send the last passing test and the rest of the tests in the response that are un run and have it generate tests that do not include the failing one
  let testsToRun: TestCaseWithTestBed[] = response.testFileArray
  let calling = 0
  while(testsToRun.length>0){
    const currentTest: TestCaseWithTestBed = testsToRun.shift()
    fs.writeFileSync(tempTestName, currentTest.testBed, 'utf-8');
    const firstTestResults: SingleTestRunResult = await tester.runSingleTest(tempTestName, currentTest.testBed)
    console.log('firstTestResults')
    console.log(firstTestResults)
    console.log('firstTestResults')
    if(firstTestResults.passed) {
      passedTests.push(currentTest)
      passedTestString += currentTest.code + '\n'
    } else {
      const lastPassingTest: TestCaseWithTestBed = passedTests[passedTests.length-1];
      console.log({passedTest: lastPassingTest.testBed, failedtest: currentTest.testBed})
      const failedTest: TestCaseWithTestBed = currentTest;
      const failedTestCaseWithTestBed: FailedTestCaseWithTestBed = { failureStackTrace: firstTestResults.testFailureStack, ...currentTest}
      failedTests.push(failedTestCaseWithTestBed)
      failedTestString += currentTest.code + '\n'
      const unfinishedTests: TestCaseWithTestBed[] = testsToRun
      //exitWithError('oops')
      const newTests = await Api.removeFailedTest({lastPassingTest, failedTest, unfinishedTests})
      calling++
      testsToRun = newTests.fixedTests;
    }
    //todo: add back failed tests if the config wants to include failed tests
    return {passedTests, failedTests}
  }
  
  console.log('We have passed tests: ' + passedTests.length)
  console.log(passedTestString)
  console.log('We have failed tests: ' + failedTests.length)
  console.log(failedTestString)
  
  console.log('we called ' + calling)
  console.log('there were  ' + response.testFileArray.length)
  process.exit()
  
  //todo: figure out how to get rid of this function deleteTempTestsAndSendResults(testFileName, firstTestResults, generationResponse, tests, sourceFileName, sourceFileContent)
}

export async function generateTest(testInput: GenerateTestOrReportInput): Promise<any> {
  const loadingIndicator = new LoadingIndicator();
  console.log(`Generating test for ${testInput.sourceFileName}`);
  console.log('    If your functions are long this could take several minutes...');
  // TODO: we need to add a timeout, somethings it hangs
  loadingIndicator.start();
  const response = await Api.generateTest(testInput);
  loadingIndicator.stop();
  return response;
}
export async function generateTestFlow(sourceFileName, sourceFileContent, testFileName, testFileContent, lastTestResults?, testCasesObj?):Promise<{serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles, response: GenerateJasmineResponse}> {
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
  const response: GenerateJasmineResponse = await generateTest(testInput);
  console.log('response')
  console.log(response)
  console.log('response')
  //fs.writeFileSync(testInput.sourceFileName + '.md', response.md)
  //this could get abstracted away
  if (response.stateCode === StateCode.FileNotSupported) {
    unsupportedFiles.push(sourceFileName);
    return undefined;
  } else if (response.stateCode === StateCode.FileFullyTested) {
    alreadyTestedFiles.push(sourceFileName);
    return undefined;
  } else if (response.stateCode === StateCode.Success) {
    if (!response?.testFileArray || isEmpty(response.testFileArray)) {
      serverDidNotSendTests.push(sourceFileName);
      console.error(`We did not receive a response from the server to generate a test for ${sourceFileName}. This should never happen`);
      return undefined;
    }
    // else we successfully got a test back from the server, now we should test them
  } else {
    console.log(CONFIG.isDevBuild ? 'Invalid stateCode received from the backend' : 'DeepUnit is out of date, please run "npm install deepunit@latest --save-dev"');
    return undefined;
  }

  /* todo: remove this stuff
  const filePathChunk = path.dirname(sourceFileName) + '/';

  let tests: { [key: string]: string } = response.tests;
  // Write the temporary test files, so we can test the generated tests
  let testPaths: string[] = Files.writeTestsToFiles(tests, filePathChunk);*/

  return {serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles, response};

}

export async function mainBugReportGeneration(sourceFileName, sourceFileContent, bugReportContent){
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
    const response = await generateBugReport(bugReportInput);

    testCasesObj = response.testCasesObj;
}

export async function generateBugReport(testInput: GenerateTestOrReportInput): Promise<any> {
  const loadingIndicator = new LoadingIndicator();
  console.log(`Generating bug report for ${testInput.sourceFileName}`);
  console.log('    If your functions are long this could take several minutes...');
  loadingIndicator.start();
  const response = await Api.generateBugReport(testInput);
  if (response) {
    Files.writeFileSync(testInput.generatedFileName, response.bugReport);
  }
  loadingIndicator.stop();
  return response;
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



