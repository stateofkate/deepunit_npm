import { execSync } from 'child_process';
import { TestResults, Tester } from './Tester';

export class JestTester extends Tester {
  public runTests(relativePathArray: string[]): any {
    const formattedPaths = relativePathArray.join(' ');

    let result;
    const command = `npx jest --json ${formattedPaths} --passWithNoTests  --runInBand`; //we should maybe add the --runTestsByPath flag, but I want to make the most minimal changes possible right now
    try {
      result = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (error: any) {
      result = error;
    }
    if (!result.numFailedTestSuites) {
      const results = JestTester.extractJSONs(result.toString());
      if (results.length > 0) {
        return JSON.parse(results[0]);
      }
    }
    return result;
  }

  public getTestResults(files: string[]): TestResults {
    const result = this.runTests(files);
    if (result.numFailedTestSuites === 0) {
      return { passedTests: files, failedTests: [], failedTestErrors: {}, failedItBlocks: {} };
    } else if (result.testResults) {
      let passedTests: string[] = [];
      let failedTests: string[] = [];
      let failedTestErrors: any = {};
      let failedItBlocks: { [key: string]: string[] } = {};
      for (const testResult of result.testResults) {
        const testPathFound: string | undefined = files.find((substring) => testResult.name.endsWith(substring));
        const testPath = testPathFound ? testPathFound : (testResult.name as string);

        if (testResult.status === 'failed') {
          failedTests.push(testPath);
          failedTestErrors[testPath] = testResult.message;
          // handle what "it" blocks failed
          const failedItStatements = testResult.assertionResults.filter((assertion: any) => assertion.status == 'failed').map((assertion: any) => assertion.title);
          if (failedItStatements.length > 0) {
            failedItBlocks[testPath] = failedItStatements;
          }
        } else if (testResult.status == 'passed') {
          passedTests.push(testPath);
        }
      }
      return { passedTests, failedTestErrors, failedTests, failedItBlocks };
    }

    throw new Error('Unable to run tests for ' + files.concat(', '));
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
