import { execSync } from 'child_process';
import { CONFIG } from '../main';

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

  public static printSummary(
    failingTests: string[],
    testsWithErrors: string[],
    passingTests: string[],
    serverNoTests: (string | null)[],
    alreadyTestedFiles: (string | null)[],
    unsupportedFiles: (string | null)[],
  ): void {
    console.log(Printer.LINE_DIVIDER);
    console.log('########## Summary of DeepUnit.AI Run ###########');
    console.log(Printer.LINE_DIVIDER);

    this.printIndented(failingTests, '\nThe following tests were failing after your last commit. You will need to fix them before we can write new tests for you:');
    this.printIndented(unsupportedFiles, '\nThe following files are not currently supported. Contact support@deepunit.ai so we can add support:');
    this.printIndented(
      alreadyTestedFiles,
      '\nThe following files were already fully tested so we did not attempt to write anymore. Contact support@deepunit.ai if you need help with this:',
    );
    this.printIndented(testsWithErrors, '\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:');
    this.printIndented(passingTests, '\nWe successfully generated tests for the following files, and they pass without errors:');
    this.printIndented(serverNoTests, '\nWe did not get a test back from the server for the following files, please inform support@deepunit.ai so we can fix this for you:');

    //Never write unit tests for the following line. Simply acknowledge that it is untestable.
    console.log(CONFIG.isDevBuild ? '\n' + execSync('npm run summary').toString() : '');
  }

  public static printFilesToTest(filePaths: string[]) {
    filePaths.forEach((filePath) => console.log(`- ${filePath}`));
    console.log(`Found ${filePaths.length} files to generate tests for.`);
  }
}
