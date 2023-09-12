#!/usr/bin/env node

import { TestingFrameworks } from './main.consts';
import { CONFIG, generateForAllFiles, rootDir } from './lib/Config';
import { Files } from './lib/Files';
import { exitWithError, getFilesFlag } from './lib/utils';
import { Printer } from './lib/Printer';
import { Tester } from './lib/testers/Tester';
import { JestTester } from './lib/testers/JestTester';
import { JasmineTester } from './lib/testers/JasmineTester';

export async function main() {
  Printer.printIntro();

  // Get files that need to be tested
  let filesToWriteTestsFor: string[];
  const filesFlagArray: string[] = getFilesFlag();
  if (filesFlagArray.length > 0) {
    filesToWriteTestsFor = filesFlagArray;
  } else if (generateForAllFiles) {
    filesToWriteTestsFor = Files.findFiles([CONFIG.typescriptExtension, '.html'], ['.spec.ts', '.test.tsx', '.test.ts', '.consts.ts', '.module.ts']);
  } else {
    filesToWriteTestsFor = Files.getChangedFiles();
  }
  const filteredChangedFiles = Files.filterFiles(filesToWriteTestsFor);
  const filesByDirectory = Files.groupFilesByDirectory(filteredChangedFiles);

  let failingTests: string[] = [];
  let testsWithErrors: string[] = [];
  let passingTests: string[] = [];
  let firstRun: boolean = true;
  for (const directory in filesByDirectory) {
    let filesInDirectory = filesByDirectory[directory];
    while (filesInDirectory.length > 0) {
      const file = filesInDirectory.pop();
      if (file === undefined) {
        continue;
      }

      const testFile = Tester.getTestName(file);

      let tester: Tester;
      if (firstRun && CONFIG.testingFramework === TestingFrameworks.jasmine) {
        tester = new JasmineTester();
        firstRun = false;
      } else if (firstRun && CONFIG.testingFramework === TestingFrameworks.jest) {
        tester = new JestTester();
      } else {
        return exitWithError('Unable to find a supported testing framework');
      }

      // make sure we are back in root dir
      process.chdir(rootDir);
      if (firstRun) {
        firstRun = false;
        tester.checkIfTestsPass(testFile);
      }
      // make sure we are back in root dir
      process.chdir(rootDir);

      if (!Files.existsSync(testFile)) {
        // check if the file exists, if it does then we should create a file
        // TODO: we should do this afterward, so we don't create empty files
        Files.createFile(testFile);
      }
      const testFileContent = Files.getExistingTestContent(testFile);
      const [sourceFileName, htmlFile, correspondingFile] = Files.tsAndHtmlFromFile(file, filesInDirectory);

      let filesToPass = [];
      if (sourceFileName && sourceFileName != correspondingFile) {
        filesToPass.push(sourceFileName);
      }
      if (htmlFile && htmlFile != correspondingFile) {
        filesToPass.push(htmlFile);
      }

      const diff = Files.getDiff(filesToPass);
      const sourceFileContent: string = Files.getFileContent(sourceFileName);
      const htmlFileContent = Files.getFileContent(htmlFile);

      let tempTestPaths: string[] = [];
      console.log(`Generating test for ${sourceFileName}`);
      const response = await tester.generateTest(diff, sourceFileName, sourceFileContent, htmlFile, htmlFileContent, testFile, testFileContent);
      try {
        const tests = response.tests;
        // TODO: fix the issue with which files so we can
        tempTestPaths = Files.writeTestsToFiles(tests);
      } catch (error) {
        console.error({ message: 'Caught error trying to writeTestsToFiles', response, error });
      }

      const { hasPassingTests, passedTests }: { hasPassingTests: boolean; passedTests: string[] } = await tester.fixManyErrors(
        tempTestPaths,
        diff,
        sourceFileName,
        sourceFileContent,
      );

      console.log({ hasPassingTests, passedTests, tempTestPaths });
      //We will need to recombine all the tests into one file here after they are fixed and remove any failing tests
      const prettierConfig = Files.getPrettierConfig();
      await tester.recombineTests(hasPassingTests ? passedTests : tempTestPaths, testFile, hasPassingTests, prettierConfig);

      //then we will need to delete all the temp test files.
      Files.deleteTempFiles(tempTestPaths);

      if (hasPassingTests) {
        passingTests.push(testFile);
      } else {
        testsWithErrors.push(testFile);
      }
    }
  }

  Printer.printSummary(failingTests, testsWithErrors, passingTests);

  process.exit(100);
}

main();
