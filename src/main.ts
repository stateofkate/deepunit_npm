#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { exitWithError, getFilesFlag, isEmpty } from './lib/utils';
import { Printer } from './lib/Printer';
import { Tester } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';
import { StateCode } from './lib/Api';

export async function main() {
  Printer.printIntro();

  // Get files that need to be tested
  let filesToWriteTestsFor: string[];
  const filesFlagArray: string[] = getFilesFlag();
  if (filesFlagArray.length > 0) {
    console.log('Finding files within --file flag');
    filesFlagArray.forEach((filePath) => {
      if (!Files.existsSync(filePath)) {
        exitWithError(`${filePath} could not be found.`);
      }
    });
    filesToWriteTestsFor = filesFlagArray;
  } else if (CONFIG.generateChangedFilesOnly) {
    console.log('Finding all changed files between current and HEAD branch.');
    filesToWriteTestsFor = Files.getChangedFiles();
  } else {
    console.log('Finding all eligible files in working directory');
    filesToWriteTestsFor = Files.findFiles([CONFIG.typescriptExtension, '.html'], ['.spec.ts', '.test.tsx', '.test.ts', '.consts.ts', '.module.ts']);
  }

  // if we didn't get any files, return error
  if (filesToWriteTestsFor.length <= 0) {
    return exitWithError(`No files to test were found. Check your config is set right or you are using the --file flag correctly.`);
  }

  Printer.printFilesToTest(filesToWriteTestsFor);
  const filesByDirectory = Files.groupFilesByDirectory(filesToWriteTestsFor);

  let failingTests: string[] = [];
  let testsWithErrors: string[] = [];
  let passingTests: string[] = [];
  let unsupportedFiles: (string | null)[] = [];
  let alreadyTestedFiles: (string | null)[] = [];
  let serverDidNotSendTests: (string | null)[] = [];
  for (const directory in filesByDirectory) {
    let filesInDirectory = filesByDirectory[directory];
    while (filesInDirectory.length > 0) {
      const file = filesInDirectory.pop();
      if (file === undefined) {
        break;
      }

      const testFileName = Tester.getTestName(file);

      let tester: Tester;
      if (CONFIG.testingFramework === TestingFrameworks.jest) {
        tester = new JestTester();
      } else {
        return exitWithError(`Unable to run DeepUnit.AI, ${CONFIG.testingFramework} is not a supported testing framework. Please read the documentation for more details.`);
      }

      let testFileContent: string = '';
      if (Files.existsSync(testFileName)) {
        const result: string | null = Files.getExistingTestContent(testFileName);
        if (testFileContent === null) {
          continue;
        } else {
          testFileContent = result as string;
        }
      }

      const [sourceFileName, htmlFileName, correspondingFile] = Files.tsAndHtmlFromFile(file, filesInDirectory);
      let filesToPass = [];
      if (sourceFileName && sourceFileName != correspondingFile) {
        filesToPass.push(sourceFileName);
      }
      if (htmlFileName && htmlFileName != correspondingFile) {
        filesToPass.push(htmlFileName);
      }

      let sourceFileDiff = '';
      if (CONFIG.generateChangedFilesOnly) {
        sourceFileDiff = Files.getDiff(filesToPass);
      }
      const sourceFileContent = Files.getFileContent(sourceFileName);
      const htmlFileContent = Files.getFileContent(htmlFileName);

      console.log(`Generating test for ${sourceFileName}`);

      const response = await tester.generateTest(sourceFileDiff, sourceFileName, sourceFileContent, htmlFileName, htmlFileContent, testFileName, testFileContent);
      if (response.stateCode === StateCode.FileNotSupported) {
        unsupportedFiles.push(sourceFileName);
      } else if (response.stateCode === StateCode.FileFullyTested) {
        alreadyTestedFiles.push(sourceFileName);
      } else if (response.stateCode === StateCode.WrongPassword) {
        exitWithError(`Incorrect password. Please be sure it is configured correctly in deepunit.config.json. Current password: ${CONFIG.password}`);
      } else if (response.stateCode === StateCode.Success) {
        if (!response?.tests || isEmpty(response.tests)) {
          serverDidNotSendTests.push(sourceFileName);
          console.error(`We did not receive a response from the server to generate a test for ${sourceFileName}. This should never happen`);
          continue;
        }
        let tests = response.tests;
        // Write the temporary test files, so we can test the generated tests
        let tempTestPaths: { [key: string]: string[] } = Files.writeTestsToFiles(tests);

        const { failedTests, passedTests } = await tester.fixManyErrors(tempTestPaths, sourceFileDiff, sourceFileName, sourceFileContent);

        //We will need to recombine all the tests into one file here after they are fixed and remove any failing tests
        const prettierConfig: Object | undefined = Files.getPrettierConfig();
        const hasPassingTests = Object.values(passedTests).length > 0;
        await tester.recombineTests(hasPassingTests ? passedTests : tempTestPaths, testFileName, testFileContent, hasPassingTests, prettierConfig);

        //then we will need to delete all the temp test files.
        Files.deleteTempFiles(CONFIG.isDevBuild ? failedTests : tempTestPaths);

        if (hasPassingTests) {
          passingTests.push(testFileName);
        } else {
          testsWithErrors.push(testFileName);
        }
      } else {
        console.log(CONFIG.isDevBuild ? 'Invalid stateCode received from the backend' : 'DeepUnit is out of date, please run "npm install deepunit@latest --save-dev"');
      }
    }
  }

  Printer.printSummary(failingTests, testsWithErrors, passingTests, serverDidNotSendTests, alreadyTestedFiles, unsupportedFiles);
  process.exit(100);
}

main();
