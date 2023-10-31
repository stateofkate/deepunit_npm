import { execSync } from 'child_process';
import { CONFIG } from './Config';

export class Printer {
  static LINE_DIVIDER = '#################################################';

  public static printOutro(): void {
    const LINE_DIVIDER = '##################################################';
    console.log(LINE_DIVIDER);
    console.log('\n We love feedback. Let us know of any suggestions, bugs, issues, or problems so we can make DeepUnit better.');
    console.log('\n To provide feedback, please run "npm run deepunit -- --feedback"')
  }

  public static printIntro() {
    const LINE_DIVIDER = '##################################################';
    console.log(LINE_DIVIDER);
    console.log('##### Generating unit tests with DeepUnit.AI #####');
    console.log(LINE_DIVIDER);
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
    testsWithErrors: string[],
    passingTests: string[],
    serverNoTests: (string | null)[],
    alreadyTestedFiles: (string | null)[],
    unsupportedFiles: (string | null)[],
  ): void {
    const LINE_DIVIDER = '#################################################';

    console.log(LINE_DIVIDER);
    console.log('########## Summary of DeepUnit.AI Run ###########');
    console.log(LINE_DIVIDER);

    this.printIndented(unsupportedFiles, '\nThe following files are not currently supported. Contact support@deepunit.ai so we can add support:');
    this.printIndented(
      alreadyTestedFiles,
      '\nThe following files were already fully tested so we did not attempt to write any more. Contact support@deepunit.ai if you need help with this:',
    );
    const errorTestsMessage = CONFIG.includeFailingTests
      ? '\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:'
      : '\nThe following tests were generated but deleted. Run DeepUnit again or set includeFailingTests true in deepunit.config.json to keep failing test';
    this.printIndented(testsWithErrors, errorTestsMessage);
    this.printIndented(passingTests, '\nWe successfully generated passing tests for the following files:');
    this.printIndented(serverNoTests, '\nWe did not get a test back from the server for the following files, please inform support@deepunit.ai so we can fix this for you:');

    //Never write unit tests for the following line. Simply acknowledge that it is untestable.
    console.log(CONFIG.isDevBuild ? '\n' + execSync('npm run summary').toString() : '');
  }

  public static printFilesToTest(filePaths: string[]) {
    filePaths.forEach((filePath) => console.log(`- ${filePath}`));
    console.log(`Found ${filePaths.length} files to generate tests for.`);
  }
}

// ANSI color escape sequences
enum COLORS {
  reset = '\x1b[0m',
  red = '\x1b[31m',
  yellow = '\x1b[33m',
  blue = '\x1b[34m',
  green = '\x1b[32m',
  white = '\x1b[37m',
}

export class Color {
  static colorize(text: string, color: COLORS) {
    return color + text + COLORS.reset;
  }

  static red(text: string) {
    return Color.colorize(text, COLORS.red);
  }

  static yellow(text: string) {
    return Color.colorize(text, COLORS.yellow);
  }

  static blue(text: string) {
    return Color.colorize(text, COLORS.blue);
  }

  static green(text: string) {
    return Color.colorize(text, COLORS.green);
  }

  static white(text: string) {
    return Color.colorize(text, COLORS.white);
  }
}
