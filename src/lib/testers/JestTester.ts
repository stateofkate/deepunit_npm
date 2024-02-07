import { ExecException, exec, execSync } from 'child_process';
import {JestTestRunResult, TestRunResult, Tester, SingleTestRunResult} from './Tester';
import {Api, ClientCode} from "../Api";

export class JestTester extends Tester {
  public async runTests(relativePathArray: string[]): Promise<JestTestRunResult[]> {
    const execPromisified = (command: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
    };

    const promises = relativePathArray.map(async (filePath) => {
      const testResult: JestTestRunResult = {
        file: filePath,
        testFailedWithError: undefined,
        jestResult: undefined,
      };
      try {
        const result = await execPromisified(`npx jest --json ${filePath} --passWithNoTests --runInBand`);
        if (result) {
          const jsonParts = JestTester.extractJSONs(result);
          if (jsonParts.length > 0) {
            testResult.jestResult = JSON.parse(jsonParts[0]);
          } else {
            testResult.jestResult = JSON.parse(result);
          }
        } else {
          // we didn't get result, fail
          testResult.testFailedWithError = 'Did not get result from jest exec command';
        }
      } catch (error) {
        testResult.testFailedWithError = error as string;
      }

      return testResult;
    });

    const aggregatedResults = await Promise.all(promises);
    return aggregatedResults;
  }
  public async runSingleTest(filePath: string): Promise<SingleTestRunResult> {
    const result: JestTestRunResult[] = await this.runTests([filePath]);
    const testResult = result[0]
    let testFailureStack;
    
    if(testResult.testFailedWithError || !testResult.jestResult || !testResult.jestResult.success) { //the test has failed, lets handle it here
      const failedTest: SingleTestRunResult = {passed: false, testFailureStack:  testResult.testFailedWithError.stack}
      return failedTest;
    } else {
      if (testResult.jestResult?.testResults[0]?.status == 'passed') {
        const passedResult: SingleTestRunResult = {
          passed: true,
        }
        return passedResult
      } else {
        // the test was a valid script, but failed
        await Api.sendAnalytics(JSON.stringify(testResult, null, 2), ClientCode.JestTesterResult); //We were having issues with this particular code path, hence the log
        const failedTest: SingleTestRunResult = {passed: false, testFailureStack:  testResult.jestResult.stack}
        return failedTest
      }
    }
  }
  public async getTestResults(files: string[]): Promise<TestRunResult> {
    const result = await this.runTests(files);
    //func name is key
    let passedTests: { [key: string]: string } = {};
    let failedTests: { [key: string]: string } = {};
    let failedTestErrors: any = {};
    let failedItBlocks: { [key: string]: string[] } = {};
    let itBlocksCount: { [key: string]: number } = {};
    for (const testResult of result) {
      const testPathFound: string | undefined = files.find((substring) => testResult.file.endsWith(substring));
      const testPath: string = testPathFound ? testPathFound : (testResult.file as string);
      const testPathChunks = testPath.split('.');
      const funcName: string = testPathChunks[0];

      if (testResult.testFailedWithError || !testResult.jestResult || !testResult.jestResult.success) {
        // if an error happened when running the test

        failedTestErrors[testPath] = testResult.testFailedWithError.stack;

        failedTests[testPath] = funcName;

      } else {
        if (testResult.jestResult?.testResults[0]?.status == 'passed') {
          passedTests[testPath] = funcName;

        } else {
          // the test was a valid script, but failed
          failedTests[testPath] = funcName;
          failedTestErrors[testPath] = testResult.jestResult.stack;
          // handle what "it" blocks failed
          await Api.sendAnalytics(JSON.stringify(testResult, null, 2), ClientCode.JestTesterResult);
          const failedItStatements = testResult.jestResult.assertionResults?.filter((assertion: any) => assertion.status == 'failed').map((assertion: any) => assertion.title);
          itBlocksCount[testPath] = testResult.jestResult.assertionResults?.length ?? 0;
          // if there is any failed statements set it
          if (failedItStatements.length > 0) {
            failedItBlocks[testPath] = failedItStatements;
          }
        }
      }
    }
    return { passedTests, failedTestErrors, failedTests, failedItBlocks, itBlocksCount };
  }

  public static extractJSONs(text: string) {
    let results = [];
    let stack = [];
    let startIdx = 0;
    let insideString = false; // Flag to indicate whether we are inside a JSON string
    let quoteChar = ''; // To store the type of quote (single or double)

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if ((char === '"' || char === "'") && stack.length > 0 && (i === 0 || text[i - 1] !== '\\')) {
        // Check if we're entering or leaving a JSON string
        if (insideString) {
          // We're possibly leaving a JSON string, but only if the char matches the starting quote
          if (char === quoteChar) {
            insideString = false;
            quoteChar = '';
          }
        } else {
          // We're entering a JSON string
          insideString = true;
          quoteChar = char;
        }
      }

      // If inside a string, ignore other characters
      if (insideString) {
        continue;
      }

      if (char === '{') {
        stack.push('{');
        if (stack.length === 1) {
          // Remember the index where the JSON string started
          startIdx = i;
        }
      } else if (char === '}') {
        if (stack.length === 0) {
          // unmatched }, ignore
          continue;
        }
        stack.pop();
        if (stack.length === 0) {
          // Complete JSON found, extract substring
          results.push(text.slice(startIdx, i + 1));
        }
      }
    }

    return results;
  }
}
