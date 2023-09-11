import { execSync } from 'child_process';
import { Tester } from './Tester';

export class JasmineTester extends Tester {
  public getTestResults(file: string[]): { failedTests: string[]; passedTests: string[]; failedTestErrors: { [key: string]: string } } {
    throw new Error('Method not implemented.');
  }
  /**
   * Parse the test output to find if tests all pass.
   *
   *   Parameters:
   *   output (str): The test output.
   */
  private parseFailedJasmineTestOutput(output: string): boolean {
    const match = output.match(/TOTAL: (\d+) FAILED, (\d+) SUCCESS/);

    if (match) {
      const failedTests = parseInt(match[1]);
      const successfulTests = parseInt(match[2]);
      return failedTests < 1; // if any tests failed return false
    } else {
      const executedMatch = output.match(/Executed (\d+) of/);
      if (executedMatch) {
        return true; // this should occur because we had no tests in the specified file, but there were no other errors in the other files
      } else {
        return false; // There was an error in this case
      }
    }
  }

  public checkIfTestsPass(testFilePath: string): boolean {
    let output;
    try {
      output = execSync(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${testFilePath}`).toString();
    } catch (error) {
      return false;
    }

    if (this.parseFailedJasmineTestOutput(output)) {
      console.error(
        `DeepUnit was unable to run because the above tests are failing. Please fix them if your last commit broke them or deleted their content and let us regenerate new ones`,
      );
      process.exit();
    }

    return true;
  }
}
