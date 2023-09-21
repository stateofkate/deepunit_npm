export class Printer {
  static LINE_DIVIDER = '#################################################';

  public static printIntro() {
    console.log(Printer.LINE_DIVIDER);
    console.log('##### Generating unit tests with DeepUnit.AI #####');
    console.log(Printer.LINE_DIVIDER);
  }

  public static printIndented(fileNames: (string | null)[], summaryDescription: string) {
    if (fileNames.length > 0) {
      console.log(summaryDescription);
      for (const test of fileNames) {
        console.log(`     ${test}`);
      }
    }
  }

  public static printSummary(failingTests: string[], testsWithErrors: string[], passingTests: string[], serverNoResponse: (string | null)[]): void {
    console.log(Printer.LINE_DIVIDER);
    console.log('########## Summary of DeepUnit.AI Run ###########');
    console.log(Printer.LINE_DIVIDER);

    this.printIndented(failingTests, '\nThe following tests were failing after your last commit. You will need to fix them before we can write new tests for you.:');
    this.printIndented(testsWithErrors, '\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:');
    this.printIndented(passingTests, '\nWe successfully generated tests for the following files, and they pass without errors:');
    this.printIndented(serverNoResponse, '\nWe did not get a test back from the server for the following files, please inform support@deepunit.ai so we can fix this for you:');
    console.log('\n');
  }

  public static printFilesToTest(filePaths: string[]) {
    // print all files we are going to test, only show 15 or it will go over the limits
    if (filePaths.length < 15) {
      filePaths.forEach((filePath) => console.log(`- ${filePath}`));
    } else {
      console.log(`Generating tests for ${filePaths.length} files.`);
    }
  }
}
