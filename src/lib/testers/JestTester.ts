import { execSync } from 'child_process';
import { TestResults, Tester } from './Tester';

export class JestTester extends Tester {
  public runTests(relativePathArray: string[]): any {
    const formattedPaths = relativePathArray.join(' ');
    let result;
    const command = `npx jest --json ${formattedPaths} --passWithNoTests`;
    try {
      result = execSync(command, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error: any) {
      result = error;
      if (error.stdout) {
        result = JSON.parse(error.stdout.toString());
      } else {
        // If there's no stdout, rethrow the error
        throw error;
      }
    }
    if (!result.numFailedTestSuites) {
      return JSON.parse(result.toString());
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
}
