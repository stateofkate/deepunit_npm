import { ExecException, exec, execSync } from 'child_process';
import {JestTestRunResult, TestRunResult, Tester, SingleTestRunResult} from './Tester';
import {Api, ClientCode} from "../Api";

export class JasmineTester extends Tester {
  public async runTests(relativePathArray: string[]): Promise<JestTestRunResult[]> {
    return []
  }
  
  public async runSingleTest(testFilePath: string): Promise<SingleTestRunResult> {
    try {
      if (testFilePath.startsWith('passport/')) {
        testFilePath = testFilePath.substring('passport/'.length);
      }
      const command = `cd passport && ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${testFilePath}`;
      console.log('Executing command:', command);
    
      // Execute the command and capture the output
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    
      console.log(output); // Log the output of the test run
      return { passed: true }; // Return output when tests passed
    } catch (error) {
      //console.log(error.stdout.split('FAILED')[1])
      //console.error('Test failed:', error); // Log the error
    
      // Check if error is an instance of Error and capture stdout and stderr
      //let errorOutput = error instanceof Error && error.stdout ? error.stdout : undefined;
      //let stdError = error instanceof Error && error.stderr ? error.stderr : undefined;
    
      // Combine stdout and stderr for complete error context
      //let combinedOutput = (errorOutput || '') + (stdError ? '\n' + stdError : '');
    console.log(error.stdout)
      const errorToDisplay = error.stdout.split('FAILED')[1] ? error.stdout.split('FAILED')[1] : error.stdout
      return {
        passed: false,
        testFailureStack: errorToDisplay//todo: make sure this is the only type of test failure possible. Off the top of my head we could have a failure due to uncompilable code, or failing assertions and perhaps even more.
      };
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
