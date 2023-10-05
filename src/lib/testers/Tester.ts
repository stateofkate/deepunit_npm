import { CONFIG } from '../../main';
import { Api } from '../Api';
import { maxFixFailingTestAttempts } from '../Config';
import { Files } from '../Files';

export type FixManyErrorsResult = {
  hasPassingTests: boolean;
  failedTests: string[];
  passedTests: string[];
};

export abstract class Tester {
  public static getTestName(file: string): string {
    const fileParts = file.split('.');
    const fileExt = fileParts[fileParts.length - 1];
    const testFileName = fileParts.slice(0, -1).join('.') + '.deepunitai.' + CONFIG.testSuffix + '.' + fileExt;
    return testFileName;
  }

  public async recombineTests(tempTestPaths: string[], finalizedTestPath: string, testFileContent: string, hasPassingTests: boolean, prettierConfig: Object | undefined) {
    if (!hasPassingTests && !CONFIG.includeFailingTests) {
      return;
    }
    const testFiles = [];
    for (let filePath of tempTestPaths) {
      //todo: we should refactor this to just hold the fixed tests in memory instead of reading/writing from the file system
      const content = Files.readFileSync(filePath).toString();
      testFiles.push(content);
    }

    const responseData = await Api.recombineTests(testFiles, testFileContent, prettierConfig);
    if (responseData && responseData.testContent) {
      let fileContent = '';
      if (!hasPassingTests) {
        fileContent += `// NOTICE: Tests in this file DID NOT PASS but are left here so you can edit them\n// To disable this feature, add "includeFailingTests": true to the deepunit.config.json.\n\n`;
      }

      fileContent += responseData.testContent;

      //TODO: APPEND TO END OF TEST FILE
      Files.writeFileSync(finalizedTestPath, fileContent);
    }
  }

  public async generateTest(diffs: string, tsFile: string | null, tsFileContent: string | null, testFile: string, testContent: string): Promise<any> {
    return await Api.generateTest(diffs, tsFile, tsFileContent, testFile, testContent);
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
    console.log(`After attempt ${attempts} We have ${result.failedTests.length} tests failing and ${result.passedTests.length} tests passing`);
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
        const testContent: string | null = Files.getExistingTestContent(failedtestName);
        if (testContent === null) {
          return null;
        }

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
      result = this.getTestResults(tempTestPaths);
      console.log(`After attempt ${attempts} We have ${result.failedTests.length} tests failing and ${result.passedTests.length} tests passing`);
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
