import { Api } from '../Api';
import { CONFIG, maxFixFailingTestAttempts } from '../Config';
import { Files } from '../Files';

type FixManyErrorsResult = {
  hasPassingTests: boolean;
  failedTests: string[];
  passedTests: string[];
};

export abstract class Tester {
  public static getTestName(file: string): string {
    const testFileName = file.split('.').slice(0, -1).join('.') + CONFIG.testExtension;
    return testFileName;
  }

  public async recombineTests(tempTestPaths: string[], finalizedTestPath: string, hasPassingTests: boolean, prettierConfig: Object | undefined) {
    if (!hasPassingTests && !CONFIG.includeFailingTests) {
      return;
    }
    const testFiles = [];
    for (let filePath of tempTestPaths) {
      //todo: we should refactor this to just hold the fixed tests in memory instead of reading/writing from the file system
      const content = Files.readFileSync(filePath).toString();
      testFiles.push(content);
    }

    const responseData = await Api.recombineTests(testFiles, prettierConfig);
    if (responseData && responseData.testContent) {
      let fileContent = responseData.testContent;
      if (!hasPassingTests) {
        fileContent = `
          // DeepUnitAi generated these tests.
          // Tests in this file DID NOT PASS but are left here so you can edit them
          // To disable this feature, add "includeFailingTests": false to the deepunit.config.json.

        `;
      }
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
  ): Promise<any> {
    try {
      const response = await Api.generateTest(diffs, tsFile, tsFileContent, htmlFile, htmlFileContent, testFile, testContent);
      return response;
    } catch (error) {
      console.error(`Failed with error: ${error}`);
      return undefined;
    }
  }

  /**
   * Takes list of tests which were generated and then fix the errors in each one, returning list of fixed tests and still failing tests.
   * @param tempTestPaths
   * @param diff
   * @param sourceFileContent
   */
  public async fixManyErrors(tempTestPaths: string[], diff: string, tsFile: string | null, sourceFileContent: string): Promise<FixManyErrorsResult> {
    let attempts = 0;
    // store the result globally so we can return the failed results at the end

    let result: {
      failedTests: string[];
      passedTests: string[];
      failedTestErrors: { [key: string]: string };
    } = this.getTestResults(tempTestPaths);
    while (attempts < maxFixFailingTestAttempts && result.failedTests.length > 0) {
      if (!result.failedTests) {
        return {
          passedTests: result.passedTests,
          hasPassingTests: result.passedTests.length > 0,
          failedTests: result.failedTests,
        };
      }

      const fixPromises = result.failedTests.map(async (failedtestName) => {
        const errorMessage: string = result.failedTestErrors[failedtestName];
        const testContent: string = Files.getExistingTestContent(failedtestName);

        try {
          const response = await Api.fixErrors(errorMessage, failedtestName, testContent, diff, sourceFileContent);
          const fixedTestCode = response.fixedTest;
          if (fixedTestCode.trim() === '') {
            console.error('Got back an empty test, this should never happen.');
            return null;
          }
          Files.writeFileSync(failedtestName, fixedTestCode);
          return failedtestName;
        } catch (error) {
          console.error(error);
        }
      });

      console.log(`Attempt ${attempts} of ${maxFixFailingTestAttempts} to fix errors for ${result.failedTests.join(', ')}`);
      const fixedTests = await Promise.all(fixPromises);
      // Filter out null values and update failedTests
      result.failedTests = result.failedTests.filter((test) => !fixedTests.includes(test));

      attempts++;
      result = this.getTestResults(tempTestPaths);
    }
    return {
      hasPassingTests: result.passedTests.length > 0,
      passedTests: result.passedTests,
      failedTests: result.failedTests,
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
