export class Printer {
  static LINE_DIVIDER = '#############################################';

  public static printIntro() {
    console.log(Printer.LINE_DIVIDER);
    console.log('##### Generating unit tests with DeepUnitAI #####');
    console.log(Printer.LINE_DIVIDER);
  }

  public static printSummary(failingTests: string[], testsWithErrors: string[], passingTests: string[]): void {
    console.log(Printer.LINE_DIVIDER);
    console.log('##### Summary of DeepUnitAI Run #####');
    console.log(Printer.LINE_DIVIDER);

    if (failingTests.length > 0) {
      console.log('\nThe following tests were failing after your last commit. You will need to fix them before we can write new tests for you.:');
      for (const test of failingTests) {
        console.log(`     ${test}`);
      }
    }

    if (testsWithErrors.length > 0) {
      console.log('\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:');
      for (const test of testsWithErrors) {
        console.log(`     ${test}`);
      }
    }

    if (passingTests.length > 0) {
      console.log('\nWe successfully generated tests for the following files, and they pass without errors:');
      for (const test of passingTests) {
        console.log(`     ${test}`);
      }
    }

    console.log('\n');
  }
}
