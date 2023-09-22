import { Api } from '../Api';
import { CONFIG, maxFixFailingTestAttempts } from '../Config';
import { Files } from '../Files';

type FixManyErrorsResult = {
  passedTests: { [key: string]: string[] };
  failedTests: { [key: string]: string[] };
};

export type Tests = {
  // part of test file
  [key: string]: {
    // temp files and content
    [key: string]: string;
  };
};

export abstract class Tester {
  public static getTestName(file: string): string {
    const testFileName = file.split('.').slice(0, -1).join('.') + '.deepunitai' + CONFIG.testExtension;
    return testFileName;
  }

  public async recombineTests(
    tempTestPaths: { [key: string]: string[] },
    finalizedTestPath: string,
    testFileContent: string,
    hasPassingTests: boolean,
    prettierConfig: Object | undefined,
  ) {
    if (!hasPassingTests && !CONFIG.includeFailingTests) {
      return;
    }
    const testFileContents: { [key: string]: string[] } = {};
    for (const [part, testPaths] of Object.entries(tempTestPaths)) {
      testFileContents[part] = [];
      for (let filePath of testPaths) {
        //todo: we should refactor this to just hold the fixed tests in memory instead of reading/writing from the file system
        const content = Files.readFileSync(filePath).toString();
        testFileContents[part].push(content);
      }
    }

    const responseData = await Api.recombineTests(testFileContents, testFileContent, prettierConfig);
    if (responseData && responseData.testContent) {
      let fileContent = `// DeepUnit.AI generated these tests on ${new Date()}\n`;
      if (!hasPassingTests) {
        fileContent += `// NOTICE: Tests in this file DID NOT PASS but are left here so you can edit them\n// To disable this feature, add "includeFailingTests": false to the deepunit.config.json.\n`;
      }

      fileContent += '\n' + responseData.testContent;

      //TODO: APPEND TO END OF TEST FILE
      Files.writeFileSync(finalizedTestPath, fileContent);
    }
  }

  public async generateTest(
    diffs: string,
    tsFile: string | null,
    tsFileContent: string | null,
    htmlFile: string | null,
    htmlFileContent: string | null,
    testFile: string,
    testContent: string,
  ): Promise<{ tests: Tests }> {
    return await Api.generateTest(diffs, tsFile, tsFileContent, htmlFile, htmlFileContent, testFile, testContent);
  }

  /**
   * Takes list of tests which were generated and then fix the errors in each one, returning list of fixed tests and still failing tests.
   * @param tempTestPaths
   * @param diff
   * @param sourceFileContent
   */
  public async fixManyErrors(tempTestPaths: { [key: string]: string[] }, diff: string, tsFile: string | null, sourceFileContent: string): Promise<FixManyErrorsResult> {
    const finalResult: { passingTests: { [key: string]: string[] }; failedTests: { [key: string]: string[] } } = {
      passingTests: {},
      failedTests: {},
    };

    for (const [testPart, testPaths] of Object.entries(tempTestPaths)) {
      let attempts = 0;

      // store the result globally so we can return the failed results at the end
      let result: {
        failedTests: string[];
        passedTests: string[];
        failedTestErrors: { [key: string]: string };
      } = this.getTestResults(testPaths);
      console.log(`After attempt ${attempts} We have ${result.failedTests.length} tests failing and ${result.passedTests.length} tests passing`);
      while (attempts < maxFixFailingTestAttempts && result.failedTests.length > 0) {
        if (!result.failedTests) {
          // all tests are passing, assign it and move to next part of test file
          finalResult.passingTests[testPart] = result.passedTests;
          continue;
        }

        const fixPromises = result.failedTests.map(async (failedtestName) => {
          const errorMessage: string = result.failedTestErrors[failedtestName];
          const testContent: string = Files.getExistingTestContent(failedtestName);

          let response;
          try {
            response = await Api.fixErrors(errorMessage, failedtestName, testContent, diff, sourceFileContent);
          } catch (error) {
            console.error(error);
            return null;
          }
          if (response === undefined) {
            return null;
          }
          if (response.fixedTest) {
            const fixedTestCode = response.fixedTest;
            if (fixedTestCode.trim() === '') {
              console.error('Got back an empty test, this should never happen.');
              return null;
            }
            Files.writeFileSync(failedtestName, fixedTestCode);
            return failedtestName;
          }
          return null;
        });

        console.log(`Attempt ${attempts} of ${maxFixFailingTestAttempts} to fix errors for ${result.failedTests.join(', ')}`);
        const fixedTests = await Promise.all(fixPromises);
        // Filter out null values and update failedTests
        result.failedTests = result.failedTests.filter((test) => !fixedTests.includes(test));

        attempts++;
        result = this.getTestResults(testPaths);
        console.log(`After attempt ${attempts} We have ${result.failedTests.length} tests failing and ${result.passedTests.length} tests passing`);
      }

      // assign whatever tests pass
      finalResult.passingTests[testPart] = result.passedTests;
      finalResult.failedTests[testPart] = result.failedTests;
    }

    return {
      passedTests: finalResult.passingTests,
      failedTests: finalResult.failedTests,
    };
  }

  /**
   * Check if the test works in the framework
   * @param testFilePath - ie. /src/examples/test.test.ts
   */
  public abstract checkIfTestsPass(testFilePath: string): boolean;

  /**
   * Similar to the checkIfTestsPass but return a more detailed answer
   * TODO: combine with checkIfTestsPass
   * @param file
   */
  public abstract getTestResults(file: string[]): {
    failedTests: string[];
    passedTests: string[];
    failedTestErrors: { [key: string]: string };
  };
}
