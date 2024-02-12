import { execSync } from 'child_process';
import { CONFIG } from './Config';

export class Printer {
  public static readonly defaultWidth: number = 60;
  public static printOutro(): void {
    const LINE_DIVIDER = '#'.repeat(Printer.defaultWidth);
    console.log(LINE_DIVIDER);
    console.log('\nWe love feedback. Let us know of any suggestions, bugs, issues, or problems so we can make DeepUnit better.');
    console.log('\nTo provide feedback, please run "npm run deepunit -- --feedback"');
  }

  public static async printIntro() {
    const version = await CONFIG.getVersion();
    const message = `Generating unit tests with DeepUnit.AI v${version}`;
    this.PrintMessageInBox(message)
    console.log('For documentation visit https://deepunit.ai/docs');
  }
  public static PrintMessageInBox(message: string): void {
    message = ` ${message} `
    // Maximum length for the message including the padding
    const maxLength = Printer.defaultWidth;
    // Minimum padding of '#' on each side
    const minPadding = 3;
    let paddedMessage: string;
    let divider = '';
    
    if (message.length + (minPadding * 2) > maxLength) {
      // If message length exceeds maximum length when considering minimum padding,
      // adjust the message and apply minimum padding
      paddedMessage = '#'.repeat(minPadding) + message + '#'.repeat(minPadding);
    } else {
      // Calculate the total padding required to make the message length equal to maxLength
      const totalPadding = maxLength - message.length;
      // Calculate how much padding to add on each side
      const paddingPerSide = totalPadding / 2;
      // Construct the padded message
      paddedMessage = '#'.repeat(paddingPerSide) + message + '#'.repeat(paddingPerSide);
    }
    
    // Create the divider with '#' characters based on the final message length
    divider = '#'.repeat(paddedMessage.length);
    
    console.log(`${divider}\n${paddedMessage}\n${divider}`);
  }
  
  
  
  public static printIndented(fileNames: (string | null)[], summaryDescription: string) {
    if (fileNames.length > 0) {
      console.log(summaryDescription);
      for (const test of fileNames) {
        console.log(`     ${test}`);
      }
    }
  }

  public static getIndented(fileNames: (string | null)[], summaryDescription: string): string {
    let message = '';
    if (fileNames.length > 0) {
      message += summaryDescription + '\n';
      for (const test of fileNames) {
        message += `     ${test}` + '\n';
      }
    }
    return message;
  }

  public static printSummary(
    testsWithErrors: string[],
    passingTests: string[],
    serverNoTests: (string | null)[],
    alreadyTestedFiles: (string | null)[],
    unsupportedFiles: (string | null)[],
  ): void {
    this.PrintMessageInBox('Summary of DeepUnit.AI Run')

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

  public static getJSONSummary(
    testsWithErrors: string[],
    passingTests: string[],
    serverNoTests: (string | null)[],
    alreadyTestedFiles: string[],
    unsupportedFiles: (string | null)[],
  ): string {
    let summary = '### Summary of DeepUnit.AI Generate Test Run\n\n';

    summary += this.getIndented(unsupportedFiles, '\nThe following files are not currently supported. Contact support@deepunit.ai so we can add support:');
    summary += this.getIndented(
      alreadyTestedFiles,
      '\nThe following files were already fully tested so we did not attempt to write any more. Contact support@deepunit.ai if you need help with this:',
    );
    const errorTestsMessage = CONFIG.includeFailingTests
      ? '\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:'
      : '\nThe following tests were generated but deleted. Run DeepUnit again or set includeFailingTests true in deepunit.config.json to keep failing test';
    summary += this.getIndented(testsWithErrors, errorTestsMessage);
    summary += this.getIndented(passingTests, '\nWe successfully generated passing tests for the following files:');
    summary += this.getIndented(
      serverNoTests,
      '\nWe did not get a test back from the server for the following files, please inform support@deepunit.ai so we can fix this for you:',
    );

    return summary;
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
  lightBlue = '\x1b[96m',
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

  static lightBlue(text: string) {
    return Color.colorize(text, COLORS.lightBlue);
  }

  static green(text: string) {
    return Color.colorize(text, COLORS.green);
  }

  static white(text: string) {
    return Color.colorize(text, COLORS.white);
  }
}
