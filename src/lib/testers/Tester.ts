import { CONFIG } from '../Config';
import { Api } from '../Api';
import { Files } from '../Files';
import { LoadingIndicator } from '../utils';
import console from '../Log';

export interface TestResults {
  failedTests: string[];
  passedTests: string[];
  failedTestErrors: { [key: string]: string };
  /**
   * Key: FileName
   * Value: List of failing it blocks
   */
  failedItBlocks: { [key: string]: string[] };
  itBlocksCount: { [key: string]: number };
}

export interface TestInput {
  sourceFileDiff: string;
  sourceFileName: string | null;
  sourceFileContent: string | null;
  testFileName: string;
  testFileContent: string;
  functionsToTest?: string[];
}

export type TestResult = {
  file: string;
  testFailedWithError: any;
  jestResult: undefined | any;
};

export abstract class Tester {

  public static getRetryFunctions(TestResults: TestResults, tempTestPaths: string[]): string[] {
    let retryFunctions: string[] = [];
    for (const testPath of tempTestPaths) {
      let successRatio = 1;
      if (TestResults.failedItBlocks[testPath]) {
        successRatio = TestResults.failedItBlocks[testPath].length / TestResults.itBlocksCount[testPath];
      }
      if (TestResults.failedTests.includes(testPath)) {
        successRatio = 0;
      }
      if (successRatio <= 0.5) {
        //get the function name so we can pass it to the backend.
        const testPathChunks = testPath.split('.');
        const funcName = testPathChunks.length >= 4? testPathChunks[testPathChunks.length - 4] : undefined;
        if (!funcName) {
          continue;
        }
        retryFunctions.push(funcName);
      }
    }
    return retryFunctions;
  }


  public static getTestName(file: string): string {
    const fileParts = file.split('.');
    const fileExt = fileParts[fileParts.length - 1];
    const testFileName = fileParts.slice(0, -1).join('.') + '.deepunitai.' + CONFIG.testSuffix + '.' + fileExt;
    return testFileName;
  }

  public static getBugReportName(file: string): string {
    const fileParts = file.split('.');
    const fileExt = 'md'
    const testFileName = fileParts.slice(0, -1).join('.') + '.deepunit_bugreport.' + CONFIG.testSuffix + '.' + fileExt;
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

  public async generateTest(testInput: TestInput): Promise<any> {
    const loadingIndicator = new LoadingIndicator();
    console.log(`Generating test for ${testInput.sourceFileName}`);
    console.log('    If your functions are long this could take several minutes...');
    // TODO: we need to add a timeout, somethings it hangs
    loadingIndicator.start();
    const response = await Api.generateTest(testInput);
    loadingIndicator.stop();
    return response;
  }


  public async generateBugReport(
      diffs: string,
      tsFile: string,
      tsFileContent: string,
      testFile: string,
      testContent: string,
      retryFunctions?: string[]): Promise<any> {
    const loadingIndicator = new LoadingIndicator();
    console.log(`Generating bug report for ${tsFile}`);
    console.log('    If your functions are long this could take several minutes...');
    loadingIndicator.start();
    const response = await Api.generateBugReport(diffs, tsFile, tsFileContent, testFile, testContent, retryFunctions);
    if (response) {
      Files.writeFileSync(tsFile, response.bugReport);
    }
    loadingIndicator.stop();
    return response;
  }

  /**
   * Check if the test works in the framework
   * @param files
   */
  public abstract getTestResults(files: string[]): Promise<TestResults>;
}

