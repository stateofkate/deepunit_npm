#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { checkFeedbackFlag, exitWithError, getBugFlag, getFilesFlag, getJsonFlag, isEmpty, promptUserInput, setupYargs, validateVersionIsUpToDate } from './lib/utils';
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

  // REMOVE< FOR FASTER TESTING
  Files.writeFileSync(
    'deepunit-tests.json',
    `{"results":[{"path":"src/examples/basic.deepunitai.test.ts","content":"import * as path from \"path\";\nimport fs from \"fs\";\nimport { squareNumber, factorial, gcd, fibonacci, circleArea } from \"./basic\";\nimport { jest } from \"@jest/globals\";\n\n// We're going to test the squareNumber function from basic.ts\n// This function should return the square of the input number\ndescribe(\"Test squareNumber function\", function () {\n  // Reset all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Restore all mocks after each test\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  it(\"should return the square of the input number\", () => {\n    const num = 2;\n    const expectedResult = 4;\n    // Call the function with our test number\n    const result = squareNumber(num);\n    // Now we assert that our function returned the expected result\n    expect(result).toBe(expectedResult);\n  });\n});\n\n// Utilizing jest framework for unit testing\ndescribe(\"factorial\", function () {\n  // Resetting all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Restoring all mocks after each test\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  // We want to test if the factorial function correctly calculates the factorial of a number\n  it(\"calculates the factorial of a number\", () => {\n    expect(factorial(5)).toBe(120); // 5! = 120\n    expect(factorial(4)).toBe(24); // 4! = 24\n  });\n  // We also want to test if the function correctly throws an error when a negative number is passed\n  it(\"throws an error when a negative number is passed\", () => {\n    expect(() => factorial(-1)).toThrow(\n      \"Negative numbers do not have a factorial\"\n    );\n  });\n  // We would like to confirm that the function returns 1 for the factorial of 0 or 1\n  it(\"returns 1 for the factorial of 0 or 1\", () => {\n    expect(factorial(0)).toBe(1); // 0! = 1\n    expect(factorial(1)).toBe(1); // 1! = 1\n  });\n});\n\n// We're going to test the gcd function in the basic.ts file.\n// The gcd function calculates the greatest common divisor of two numbers.\n// This is an important function in number theory and is used in various algorithms.\n// We need to make sure this function is working correctly, as incorrect results could lead to problems in any algorithms that use it.\ndescribe(\"gcd\", function () {\n  // Resetting all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Restoring all mocks after each test\n  afterAll(() => {\n    jest.restoreAllMocks();\n  });\n  // Test case 1: Check the gcd of two numbers\n  it(\"should return the correct gcd of two numbers\", () => {\n    const a = 48;\n    const b = 18;\n    const expected = 6;\n    const result = gcd(a, b);\n    expect(result).toBe(expected);\n  });\n  // Test case 2: Check the gcd of a number and zero\n  // The gcd of a number and zero should be the number itself\n  it(\"should return the first number when the second number is zero\", () => {\n    const a = 48;\n    const b = 0;\n    const expected = a;\n    const result = gcd(a, b);\n    expect(result).toBe(expected);\n  });\n});\n\n// We use jest's describe function to group our tests together\ndescribe(\"fibonacci\", function () {\n  // Using jest's beforeEach function to reset all mocks before each test\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Using jest's afterEach function to restore all mocks after each test\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  // Our first test will check if the fibonacci function throws an error when a negative number is passed\n  it(\"should throw an error for negative numbers\", () => {\n    expect(() => fibonacci(-1)).toThrow(\"Not a valid number\");\n  });\n  // Our next test will check if the fibonacci function returns the correct values for the first two numbers in the sequence\n  it(\"should return the same number for 0 and 1\", () => {\n    expect(fibonacci(0)).toBe(0);\n    expect(fibonacci(1)).toBe(1);\n  });\n  // Our final test will check if the fibonacci function returns the correct value for a number higher than 1\n  it(\"should return the correct fibonacci number for n > 1\", () => {\n    expect(fibonacci(2)).toBe(1);\n    expect(fibonacci(3)).toBe(2);\n    expect(fibonacci(10)).toBe(55);\n  });\n});\n\n// Jest's describe function is used to group one or more related tests\ndescribe(\"circleArea\", function () {\n  // Jest's beforeEach function is used to run some setup code before each test in the describe block.\n  beforeEach(() => {\n    jest.resetAllMocks();\n  });\n  // Jest's afterEach function is used to reset some setup or state after each test in the describe block.\n  afterEach(() => {\n    jest.restoreAllMocks();\n  });\n  // Jest's it function represents an individual unit of test\n  it(\"should throw an error if radius is less than 0\", () => {\n    // We want to test if the function throws an error when radius is less than 0.\n    // We use expect along with a function and toThrow because we are expecting an error to be thrown.\n    expect(() => circleArea(-1)).toThrow(\"Radius can not be negative\");\n  });\n  it(\"should return the correct area of the circle\", () => {\n    // We want to test if the function correctly calculates the area of the circle.\n    // We use expect along with toBeCloseTo because we are dealing with floating-point numbers.\n    expect(circleArea(5)).toBeCloseTo(78.53981633974483);\n  });\n});\n"}]}`,
  );

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

    if (getJsonFlag()) {
      Files.writeFileSync('deepunit-tests.json', JSON.stringify({ results: completedTestFiles }));
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
