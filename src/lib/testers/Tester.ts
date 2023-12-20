import { CONFIG } from '../Config';
import { Api } from '../Api';
import { Files } from '../Files';
import { LoadingIndicator, getJsonFlag } from '../utils';
import console from '../Log';

export interface TestRunResult {
  passedTests: { [key: string]: string };
  failedTests: { [key: string]: string };
  failedTestErrors: { [key: string]: string };
  /**
   * Key: FileName
   * Value: List of failing it blocks
   */
  failedItBlocks: { [key: string]: string[] };
  itBlocksCount: { [key: string]: number };
}


export interface GenerateTestOrReportInput {
  sourceFileDiff: string;
  sourceFileName: string | null;
  sourceFileContent: string | null;
  generatedFileName: string;
  generatedFileContent: string;
  functionsToTest?: string[];
  testCasesObj?: { [key: string]: string };
}

export type JestTestRunResult = {
  file: string;
  testFailedWithError: any;
  jestResult: undefined | any;
};


export abstract class Tester {

  public static getRetryFunctions(TestResults: TestRunResult, tempTestPaths: string[]): string[] {
    let retryFunctions: string[] = [];
    for (const testPath of tempTestPaths) {
      let successRatio = 1;
      if (TestResults.failedItBlocks[testPath]) {
        successRatio = TestResults.failedItBlocks[testPath].length / TestResults.itBlocksCount[testPath];
      }
      if (testPath in TestResults.failedTests) {
        successRatio = 0;
      }
      if (successRatio <= 0.5) {
        //get the function name so we can pass it to the backend.
        const testPathChunks = testPath.split('.');
        const funcName = testPathChunks[0];
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
    const fileExt = 'md';
    const testFileName = fileParts.slice(0, -1).join('.') + '.deepunit_bugreport.' + CONFIG.testSuffix + '.' + fileExt;
    return testFileName;
  }

  public async recombineTests(
    tempTestPaths: { [key: string]: string },
    finalizedTestPath: string,
    testFileContent: string,
    failedTests: { [key: string]: string },
    failedItBlocks: { [key: string]: string[] },
    prettierConfig: Object | undefined,
  ): Promise<string | undefined> {
    const responseData = await Api.recombineTests(tempTestPaths, testFileContent, failedTests, failedItBlocks, prettierConfig);
    if (responseData && responseData.testContent) {
      return responseData.testContent;
    }
  }

  public async generateTest(testInput: GenerateTestOrReportInput): Promise<any> {
    const loadingIndicator = new LoadingIndicator();
    console.log(`Generating test for ${testInput.sourceFileName}`);
    console.log('    If your functions are long this could take several minutes...');
    // TODO: we need to add a timeout, somethings it hangs
    loadingIndicator.start();
    const response = await Api.generateTest(testInput);
    loadingIndicator.stop();
    return response;
  }


  public async generateBugReport(testInput: GenerateTestOrReportInput): Promise<any> {
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

  /**
   * Check if the test works in the framework
   * @param files
   */
  public abstract getTestResults(files: string[]): Promise<TestRunResult>;
}
