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
export type TestCaseWithTestBed = {code?: string, testCase: ParsedTestCases, duplicate: boolean, testBed?: string, functionName?: string; sourceFileName: string}
export type FailedTestCaseWithTestBed = {code?: string, testCase: ParsedTestCases, duplicate: boolean, testBed?: string, functionName?: string; failureStackTrace: string; sourceFileName: string;}
export type GenerateJasmineResponse = { testFileArray?: TestCaseWithTestBed[]; generatedTestBed: (string | undefined); testCaseIts: FunctionToTestCaseCode[], md:string, tests?: any[]; stateCode?: StateCode; stateMessage?: string; error?: string };
export type FunctionToTestCaseCode = {
  functionName: string;
  testCases: TestCaseAndCode[]
}
export type ResultSummary = {
  alreadyTestedFiles: string[];
  unsupportedFiles: string[];
  passedTests: TestCaseWithTestBed[]; failedTests: FailedTestCaseWithTestBed[], serverDidNotSendTests: string[], completedTestFiles: { path: string; content: string }[] }
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
  let resultsSummary: ResultSummary = {completedTestFiles: [], alreadyTestedFiles: [], passedTests:[], failedTests: [], serverDidNotSendTests: [], unsupportedFiles: []}
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
      //We will first generate a bunch of unit tests that can be added into the files
      const {serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles, response} = await generateTestFlow(sourceFileName, sourceFileContent, testFileName, testFileContent, prettierConfig)
      resultsSummary.serverDidNotSendTests = resultsSummary.serverDidNotSendTests.concat(serverDidNotSendTests)
      resultsSummary.unsupportedFiles = resultsSummary.unsupportedFiles.concat(unsupportedFiles)
      resultsSummary.alreadyTestedFiles = resultsSummary.alreadyTestedFiles.concat(alreadyTestedFiles)
      
      //here we will loop thru the tests running each until we know which ones pass
      const testResults: { failedTests: FailedTestCaseWithTestBed[]; passedTests: TestCaseWithTestBed[], completedTestFile: { content: string, path: string}, passingTestFile: { content: string; path: string }} = await runGeneratedTests(response, sourceFileName, testFileName)
      //edit flow to go here
      //update results after the edit flow
      resultsSummary.passedTests = resultsSummary.passedTests.concat(testResults.passedTests)
      resultsSummary.failedTests = resultsSummary.failedTests.concat(testResults.failedTests)
      resultsSummary.completedTestFiles.push(testResults.completedTestFile)
      
      writeFinalTestFile(testResults.completedTestFile, testResults.passingTestFile)
    }
  }
  await printResultsAndExit(resultsSummary)
}

export async function runGeneratedTests(response: GenerateJasmineResponse, sourceFileName: string, testFileName: string): Promise<{ failedTests: FailedTestCaseWithTestBed[]; passedTests: TestCaseWithTestBed[]; completedTestFile: { content: string; path: string }; passingTestFile: { content: string; path: string } }> {
  let tester = getTester();
  const lastDotIndex = sourceFileName.lastIndexOf('.');
  const fileNameWithoutExt = sourceFileName.substring(0, lastDotIndex);
  const fileExt = sourceFileName.substring(lastDotIndex + 1);
  const tempTestName = `${fileNameWithoutExt}.deepunittemptest.${CONFIG.testSuffix}.${fileExt}`;
  let passedTests: TestCaseWithTestBed[] = [];
  let passedTestString = ''
  let failedTestString = ''
  let failedTests: FailedTestCaseWithTestBed[]= []
  let completedTestFile = { content: '', path: testFileName}
  let passingTestFile = { content: '', path: testFileName}
  //here we will go thru the tests until we find one that fails.
  //If it fails we will send the last passing test and the rest of the tests in the response that are un run and have it generate tests that do not include the failing one
  let testsToRun: TestCaseWithTestBed[] = [].concat(response.testFileArray) //create a clone of response.testFileArray so response.testFileArray is not mutated
  let calling = 0
  while(testsToRun.length>0){
    const currentTest: TestCaseWithTestBed = testsToRun.shift()
    fs.writeFileSync(tempTestName, currentTest.testBed, 'utf-8');
    const singleTestRunResult: SingleTestRunResult = await tester.runSingleTest(tempTestName, currentTest.testBed)
    if(singleTestRunResult.passed) {
      passedTests.push(currentTest)
      passedTestString += currentTest.code + '\n'
      completedTestFile.content = currentTest.testBed
      passingTestFile.content = currentTest.testBed
    } else {
      const failedTestCaseWithTestBed: FailedTestCaseWithTestBed = { failureStackTrace: singleTestRunResult.testFailureStack, ...currentTest}
      failedTests.push(failedTestCaseWithTestBed)
      failedTestString += currentTest.code + '\n'
      let ableToFix = false;
      if(passedTests.length > 0) {
          const lastPassingTest: TestCaseWithTestBed = passedTests[passedTests.length-1];
          const failedTest: TestCaseWithTestBed = currentTest;
          const unfinishedTests: TestCaseWithTestBed[] = testsToRun
          const newTests = await Api.removeFailedTest({lastPassingTest, failedTest, unfinishedTests})
          testsToRun = newTests.fixedTests;
      } else {
        //todo: add a test fixing flow here. Figure out how to handle tracking a first test that failed but got fixed
      }
    }
    fs.rm(tempTestName, ()=>{});//removing the file can be async for slightly better performance
  }
  if(CONFIG.includeFailingTests) {
    const lastTest = response.testFileArray[response.testFileArray.length - 1].testBed
    completedTestFile.content = lastTest
  }
  return {passedTests, failedTests, completedTestFile, passingTestFile}//the passingtestFile is for the vs Code extension as we will only include passing tests in this context
  //todo: figure out how to get rid of this function
  // So basically what the function does is delete the temp tests, collate results and send them to the backend
  // it also writes the json flag, prints the outro and does the final process.exit and sends the logs
  // so maybe we dont remove this but make it some other function like printAndExit() where we just print results, write json and exit. Mostly the deleting temp files that needs to move.
  // deleteTempTestsAndSendResults(testFileName, firstTestResults, generationResponse, tests, sourceFileName, sourceFileContent)
}
export function writeFinalTestFile(completedTestFile, passingTestFile) {
  if(CONFIG.includeFailingTests && completedTestFile.content && completedTestFile.path) {
    fs.writeFileSync(completedTestFile.path, completedTestFile.content, 'utf-8');
  } else {
    if(passingTestFile.content && passingTestFile.path) {
      fs.writeFileSync(passingTestFile.path, passingTestFile.content, 'utf-8')
    } else {
      console.log({message: 'passingTestFile path or content was empty!', passingTestFile, completedTestFile})
    }
  }
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
  let serverDidNotSendTests: string[] = [];

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
      if(sourceFileName){
        serverDidNotSendTests.push(sourceFileName);
      }
      console.error(`We did not receive a response from the server to generate a test for ${sourceFileName}. This should never happen`);
      return undefined;
    }
    // else we successfully got a test back from the server, now we should test them
  } else {
    console.log(CONFIG.isDevBuild ? 'Invalid stateCode received from the backend' : 'DeepUnit is out of date, please run "npm install deepunit@latest --save-dev"');
    return undefined;
  }

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
export async function printResultsAndExit(testResults: ResultSummary){
  let {passedTests, failedTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles, completedTestFiles } = testResults;
  let testsWithErrors: string[] = []
  let passingTests: string[] = []
  for(const failedTest of failedTests) {
    const fileName = failedTest.sourceFileName;
    if(!testsWithErrors.includes(fileName)) {
      testsWithErrors.push(fileName)
    }
  }
  for(const passedTest of passedTests) {
    const fileName = passedTest.sourceFileName
    if(!passingTests.includes(fileName)) {
      passingTests.push(fileName)
    }
  }
  
  if (getJsonFlag() && completedTestFiles.length > 0) {
    const summary = Printer.getJSONSummary(testsWithErrors, passingTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles);
    const deepunitTests: string = JSON.stringify({results: completedTestFiles, summary, meta: getMetaFlag() ?? '', failedTests, passedTests}, null, 2)
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



