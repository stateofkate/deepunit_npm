#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG } from './lib/Config';
import { Files } from './lib/Files';
import { exitWithError, getFilesFlag, isEmpty } from './lib/utils';
import { Printer } from './lib/Printer';
import { Tester } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';

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

  const filteredFileNames = Files.filterFiles(filesToWriteTestsFor);

  // if we didn't get any files, return error
  if (filteredFileNames.length <= 0) {
    return exitWithError(`No files to test were found. Check your config is set right or you are using the --file flag correctly.`);
  }

  Printer.printFilesToTest(filteredFileNames);
  const filesByDirectory = Files.groupFilesByDirectory(filteredFileNames);

  let failingTests: string[] = [];
  let testsWithErrors: string[] = [];
  let passingTests: string[] = [];
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

      let testFileContent = '';
      if (Files.existsSync(testFileName)) {
        testFileContent = Files.getExistingTestContent(testFileName);
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
      if (!response.tests || isEmpty(response.tests)) {
        exitWithError('Unable to continue, did not receive tests back from server.');
      }
      let tests: Record<string, string> = response.tests;
      // Write the temporary test files, so we can test the generated tests
      let tempTestPaths: string[] = Files.writeTestsToFiles(tests);

      const { hasPassingTests, passedTests }: { hasPassingTests: boolean; passedTests: string[] } = await tester.fixManyErrors(
        tempTestPaths,
        sourceFileDiff,
        sourceFileName,
        sourceFileContent,
      );

      console.log({ hasPassingTests, passedTests, tempTestPaths });
      //We will need to recombine all the tests into one file here after they are fixed and remove any failing tests
      const prettierConfig = Files.getPrettierConfig();
      await tester.recombineTests(hasPassingTests ? passedTests : tempTestPaths, testFileName, testFileContent, hasPassingTests, prettierConfig);

      //then we will need to delete all the temp test files.
      Files.deleteTempFiles(tempTestPaths);

      if (hasPassingTests) {
        passingTests.push(testFileName);
      } else {
        testsWithErrors.push(testFileName);
      }
    }
  }

  Printer.printSummary(failingTests, testsWithErrors, passingTests);

  process.exit(100);
}

main();
