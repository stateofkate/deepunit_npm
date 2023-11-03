import { CONFIG } from '../Config';
import { Api } from '../Api';
import { Files } from '../Files';

export interface ErrorDetail {
  file: string;
  testFailedWithError: {
    message: string;
    stack: string;
    name: string;
  }
}

export interface TestResults {
  failedTests: string[];
  passedTests: string[];
  failedTestErrors: { [key: string]: ErrorDetail };
  /**
   * Key: FileName
   * Value: List of failing it blocks
   */
  failedItBlocks: { [key: string]: string[] };
};

export type TestResult = {
  file: string;
  testFailedWithError: undefined | string;
  jestResult: undefined | any;
};

export abstract class Tester {
  public static getTestName(file: string): string {
    const fileParts = file.split('.');
    const fileExt = fileParts[fileParts.length - 1];
    const testFileName = fileParts.slice(0, -1).join('.') + '.deepunitai.' + CONFIG.testSuffix + '.' + fileExt;
    return testFileName;
  }

  public async recombineTests(
    tempTestPaths: { [key: string]: string },
    finalizedTestPath: string,
    testFileContent: string,
    failedItBlocks: { [key: string]: string[] },
    failedTests: string[],
    prettierConfig: Object | undefined,
  ) {
    const responseData = await Api.recombineTests(tempTestPaths, testFileContent, failedItBlocks, failedTests, prettierConfig);
    if (responseData && responseData.testContent) {
      Files.writeFileSync(finalizedTestPath, responseData.testContent);
    }
  }

  public async generateTest(diffs: string, tsFile: string | null, tsFileContent: string | null, testFile: string, testContent: string): Promise<any> {
    return await Api.generateTest(diffs, tsFile, tsFileContent, testFile, testContent);
  }

  /**
   * Check if the test works in the framework
   * @param files
   */
  public abstract getTestResults(files: string[]): Promise<TestResults>;
}
