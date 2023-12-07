#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { checkFeedbackFlag, exitWithError, getBugFlag, getFilesFlag, getJsonFlag, getMetaFlag, isEmpty, promptUserInput, setupYargs, validateVersionIsUpToDate } from './lib/utils';
import { Color, Printer } from './lib/Printer';
import { Tester, TestResults } from './lib/testers/Tester';
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

  const completedTestFiles: { path: string; content: string }[] = [];

  // // REMOVE< FOR FASTER TESTING
  // Files.writeFileSync(
  //   'deepunit-tests.json',
  //   JSON.stringify({
  //     results: [
  //       {
  //         path: 'src/examples/basic.deepunitai.test.ts',
  //         content:
  //           'import * as path from "path";\nimport fs from "fs";\nimport {\n  squareNumber,\n  factorial,\n  gcd,\n  fibonacci,\n  circleArea,\n  is32Bit,\n} from "./basic";\nimport { describe, it, jest, beforeEach, afterEach } from "@jest/globals";\n\n// Mock fs and path modules as they are not used in the tests\njest.mock("fs");\n\njest.mock("path");\n\ndescribe("basic.ts", function () {\n  // Reset all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Restore all mocks after each test\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  describe("squareNumber", () => {\n    // We want to test if the squareNumber function correctly squares the input number\n    it("should correctly square the input number", () => {\n      const input = 2;\n      const output = squareNumber(input);\n      // Expected result is 4 because 2 squared is 4\n      const expectedResult = 4;\n      // The output of the function should equal the expected result\n      expect(output).toBe(expectedResult);\n    });\n  });\n});\n\n// Using Jest for testing\ndescribe("factorial", function () {\n  // Resetting all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Restoring all mocks after each test\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  // Testing the factorial function\n  it("should return the factorial of a number", () => {\n    // We want to test if the function correctly calculates the factorial of a number\n    // This is to ensure that the logic of the function is implemented correctly\n    expect(factorial(5)).toBe(120);\n    expect(factorial(0)).toBe(1);\n  });\n  it("should throw an error for negative numbers", () => {\n    // We want to test if the function throws an error for negative numbers\n    // This is because factorials for negative numbers are undefined, and we want to make sure our function handles this edge case\n    expect(() => factorial(-1)).toThrow(\n      "Negative numbers do not have a factorial"\n    );\n  });\n});\n\n// We are using the Jest testing framework\n// We will be testing the gcd function in basic.ts\ndescribe("gcd function tests", function () {\n  // This runs before each test, resetting all mocks\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // This runs after each test, restoring all mocks\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  // Testing gcd function\n  // We want to test this function to ensure it correctly calculates the greatest common divisor of two numbers\n  it("should correctly calculate the gcd of two numbers", () => {\n    const a = 48;\n    const b = 18;\n    const expectedResult = 6;\n    const result = gcd(a, b);\n    expect(result).toEqual(expectedResult);\n  });\n  // Testing if gcd function handles 0 as input\n  // We want to test this case because the gcd of a number and 0 is the number itself\n  it("should return the non-zero number when one of the inputs is 0", () => {\n    const a = 48;\n    const b = 0;\n    const expectedResult = 48;\n    const result = gcd(a, b);\n    expect(result).toEqual(expectedResult);\n  });\n});\n\n// Mock fs and path modules as they are not used in the tests\n\n// Mock fs and path modules as they are not used in the tests\n// Using describe to group similar tests\ndescribe("fibonacci", function () {\n  // Using beforeEach to reset all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Using afterAll to restore all mocks after all tests\n  afterAll(() => {\n    jest.restoreAllMocks();\n  });\n  // Testing the fibonacci function with valid input\n  it("calculates the correct fibonacci number for valid input", () => {\n    expect(fibonacci(10)).toBe(55);\n    expect(fibonacci(15)).toBe(610);\n  });\n  // Testing the fibonacci function with invalid input\n  it("throws an error for invalid input", () => {\n    expect(() => fibonacci(-1)).toThrow("Not a valid number");\n  });\n  // Testing the fibonacci function with edge case input\n  it("handles edge cases correctly", () => {\n    expect(fibonacci(0)).toBe(0);\n    expect(fibonacci(1)).toBe(1);\n  });\n});\n\n// This file tests the circleArea function in basic.ts\ndescribe("circleArea", function () {\n  // Reset all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Restore all mocks after each test\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  // Test case 1: Check the function with a positive value\n  it("should calculate the area of a circle with positive radius correctly", () => {\n    // Radius for our test case\n    const radius = 3;\n    // Expected output\n    const expectedArea = Math.PI * Math.pow(radius, 2);\n    // Calculate circle area\n    const area = circleArea(radius);\n    // Check if the function returns the correct area\n    expect(area).toEqual(expectedArea);\n  });\n  // Test case 2: Check the function with a negative value\n  it("should throw an error when radius is negative", () => {\n    // Negative radius\n    const radius = -3;\n    // We expect the function to throw an error\n    expect(() => circleArea(radius)).toThrow("Radius can not be negative");\n  });\n});\n\n// We are testing the `is32Bit` function from `src/examples/basic.ts`.\n// This function checks if a number is a 32-bit integer or not.\ndescribe("is32Bit", function () {\n  // Reset all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Restore all mocks after each test\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  // We are testing the case where the input is less than or equal to 2_147_483_647,\n  // which should return true, indicating the number is a 32-bit integer.\n  it("should return true for a 32-bit integer", () => {\n    const result = is32Bit(2147483647);\n    expect(result).toBe(true);\n  });\n  // We are testing the case where the input is greater than 2_147_483_647,\n  // which should return false, indicating the number is not a 32-bit integer.\n  it("should return false for a number greater than a 32-bit integer", () => {\n    const result = is32Bit(2147483648);\n    expect(result).toBe(false);\n  });\n});\n',
  //       },
  //     ],
  //     meta: '10',
  //   }),
  // );

  if (flagType != 'bugFlag') {
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
        const response = await tester.generateTest(sourceFileDiff, sourceFileName, sourceFileContent, testFileName, testFileContent);
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

        // if we are then we are good to go, keep processing test
        let tests: Record<string, string> = response.tests;
        // Write the temporary test files, so we can test the generated tests
        let tempTestPaths: string[] = Files.writeTestsToFiles(tests);

        let { failedTests, passedTests, failedTestErrors, failedItBlocks, itBlocksCount }: TestResults = await tester.getTestResults(tempTestPaths);

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
            //Re-write these files
            tests = { ...tests, ...retryFunctionsResponse.tests };
            tempTestPaths = [...tempTestPaths, ...Files.writeTestsToFiles(retryFunctionsResponse.tests)];
          }
        }

        // retest everything, that way we have a better knowledge of what succeeded
        const newTestResults = await tester.getTestResults(tempTestPaths);
        failedTests = newTestResults.failedTests;
        passedTests = newTestResults.passedTests;
        failedTestErrors = newTestResults.failedTestErrors;
        failedItBlocks = newTestResults.failedItBlocks;
        itBlocksCount = newTestResults.itBlocksCount;

        Api.sendResults(failedTests, passedTests, tests, failedTestErrors, sourceFileName, sourceFileContent);
        const testFile = await tester.recombineTests(tests, testFileName, testFileContent, failedItBlocks, failedTests, prettierConfig);

        if (testFile) {
          if (getJsonFlag()) {
            // store for later export
            completedTestFiles.push({ path: testFileName, content: testFile });
          } else {
            Files.writeFileSync(testFileName, testFile);
          }
        } else {
          console.warn('Unable to recombine tests');
        }

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

    if (getJsonFlag() && completedTestFiles.length > 0) {
      Files.writeFileSync('deepunit-tests.json', JSON.stringify({ results: completedTestFiles, meta: getMetaFlag() ?? '' }));
    }

    Printer.printSummary(testsWithErrors, passingTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles);
    Printer.printOutro();
    if (filesToTest.length === 0) {
      console.log('We found no files to test. For complete documentation visit https://deepunit.ai/docs');
    }
    await Log.getInstance().sendLogs();
    process.exit(0);
  } else if (flagType == 'bugFlag') {
    for (const directory in filesByDirectory) {
      let filesInDirectory = filesByDirectory[directory];
      while (filesInDirectory.length > 0) {
        const sourceFileName = filesInDirectory.pop();
        if (sourceFileName === undefined) {
          continue;
        }

        const bugFileName = Tester.getBugReportName(sourceFileName);

        let tester: Tester;

        tester = new JestTester();

        let bugFileContent: string = '';
        if (Files.existsSync(bugFileName)) {
          const result: string | null = Files.getExistingTestContent(bugFileName);
          if (!bugFileContent) {
            continue;
          } else {
            bugFileContent = result as string;
          }
        }

        let sourceFileDiff = '';
        const files = getBugFlag() ?? [];
        const sourceFileContent = Files.getFileContent(sourceFileName);
        await tester.generateBugReport(sourceFileDiff, sourceFileContent, sourceFileName, bugFileName, bugFileContent);
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
