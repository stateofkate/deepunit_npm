#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG, rootDir } from './lib/Config';
import { Files } from './lib/Files';
import { exitWithError, getFilesFlag } from './lib/utils';
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
    filesToWriteTestsFor = filesFlagArray.filter((filePath) => Files.existsSync(filePath));
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
    return exitWithError(`Unable to run DeepUnitAI, No files to test were found. Check your config is set right or you are using the --file flag correctly.`);
  }

  Printer.printFilesToTest(filteredFileNames);
  const filesByDirectory = Files.groupFilesByDirectory(filteredFileNames);

  let failingTests: string[] = [];
  let testsWithErrors: string[] = [];
  let passingTests: string[] = [];
  let firstRun: boolean = true;
  for (const directory in filesByDirectory) {
    let filesInDirectory = filesByDirectory[directory];
    while (filesInDirectory.length > 0) {
      const file = filesInDirectory.pop();
      if (file === undefined) {
        break;
      }

      const testFileName = Tester.getTestName(file);

      let tester: Tester;
      if (firstRun && CONFIG.testingFramework === TestingFrameworks.jest) {
        tester = new JestTester();
      } else {
        return exitWithError(`Unable to run DeepUnitAI, ${CONFIG.testingFramework} is not a supported testing framework. Please read the documentation for more details.`);
      }

      // make sure we are back in root dir
      process.chdir(rootDir);
      const originalTestFilePasses = tester.checkIfTestsPass(testFileName);

      if (!originalTestFilePasses) {
        console.log(`Test file ${testFileName}, does not pass it's tests, please fix the tests before we add to this file.`);
      }
      // make sure we are back in root dir
      process.chdir(rootDir);

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
      await tester.recombineTests(hasPassingTests ? passedTests : tempTestPaths, testFileName, hasPassingTests, prettierConfig);

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
