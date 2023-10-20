import { ExecException, exec, execSync } from 'child_process';
import { TestResult, TestResults, Tester } from './Tester';

export class JestTester extends Tester {
  public async runTests(relativePathArray: string[]): Promise<TestResult[]> {
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
      const testResult: TestResult = {
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

  public async getTestResults(files: string[]): Promise<TestResults> {
    const result = await this.runTests(files);
    let passedTests: string[] = [];
    let failedTests: string[] = [];
    let failedTestErrors: any = {};
    let failedItBlocks: { [key: string]: string[] } = {};
    for (const testResult of result) {
      const testPathFound: string | undefined = files.find((substring) => testResult.file.endsWith(substring));
      const testPath = testPathFound ? testPathFound : (testResult.file as string);

      if (testResult.testFailedWithError || !testResult.jestResult || !testResult.jestResult.success) {
        // an error happened when running the test
        failedTests.push(testPath);
        failedTestErrors[testPath] = testResult.testFailedWithError;
      } else {
        if (testResult.jestResult.testResults[0].status == 'passed') {
          passedTests.push(testPath);
        } else {
          // the test was a valid script, but failed
          failedTests.push(testPath);
          failedTestErrors[testPath] = testResult.jestResult.message;
          // handle what "it" blocks failed
          const failedItStatements = testResult.jestResult.assertionResults.filter((assertion: any) => assertion.status == 'failed').map((assertion: any) => assertion.title);
          if (failedItStatements.length > 0) {
            failedItBlocks[testPath] = failedItStatements;
          }
        }
      }
    }
    return { passedTests, failedTestErrors, failedTests, failedItBlocks };
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
