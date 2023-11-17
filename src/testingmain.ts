import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { checkFeedbackFlag, exitWithError, getFilesFlag, isEmpty, promptUserInput, setupYargs, validateVersionIsUpToDate } from './lib/utils';
import { Color, Printer } from './lib/Printer';
import { Tester, TestResults } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';
import { Api, ClientCode, StateCode } from './lib/Api';
import { Auth } from './lib/Auth';
import {Log} from "./lib/Log";

// global classes


export let AUTH: Auth;

console.log('works');

export async function main() {
  setupYargs();

  Printer.printIntro();
  if (process.platform === 'win32') {
    return exitWithError(
      Color.red(
        'We do not support windows yet, although we do support using deepunit through WSL on windows(https://learn.microsoft.com/en-us/windows/wsl/install). If you would like us to support windows please email us.',
      ),
    );
  }

  // setup the auth channel and see if they are logged in or not
  AUTH = await Auth.init();

  // check to confirm we still support this version
  await validateVersionIsUpToDate();
  Files.setup();

  // confirm we have all packages for type of project
  await CONFIG.confirmAllPackagesNeeded();

  // check to confirm we still support this version
  if (checkFeedbackFlag()) {
    const feedback = await promptUserInput(
      'We love feedback. Let us know of suggestions, bugs, issues, or problems so we can make DeepUnit better: ',
      'Thank you for your feedback!',
    );
    const subject: string = '--feedback';
    await Api.Feedback(feedback, subject);
    process.exit(0);
  }

  const prettierConfig: Object | undefined = Files.getPrettierConfig();

  // Get files that need to be tested
  const filesToTest = Files.getFilesToTest();

  Printer.printFilesToTest(filesToTest);

  const filesByDirectory = Files.groupFilesByDirectory(filesToTest);

  for (const directory in filesByDirectory) {
    let filesInDirectory = filesByDirectory[directory];
    while (filesInDirectory.length > 0) {
      const sourceFileName = filesInDirectory.pop();
      if (sourceFileName === undefined) {
        continue;
      }

      const testFileName = Tester.getBugReportName(sourceFileName);

      let tester: Tester;

      tester = new JestTester();

      let testBugFileContent: string = '';
      if (Files.existsSync(testFileName)) {
        const result: string | null = Files.getExistingTestContent(testFileName);
        if (testBugFileContent === null) {
          continue;
        } else {
          testBugFileContent = result as string;
        }
      }

      let sourceFileDiff = '';
      const files = getFilesFlag() ?? [];
      const sourceFileContent = Files.getFileContent(sourceFileName);
      const response = await tester.generateBugReport(sourceFileDiff, testFileName, sourceFileContent, testFileName, testBugFileContent);

      console.log(response);


      //Write the temporary test files, so we can test the generated tests


    }


  }
}

if (require.main === module) {
  main();
}

