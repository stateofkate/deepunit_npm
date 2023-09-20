// DeepUnit.AI generated these tests on Tue Sep 19 2023 18:29:55 GMT-0700 (Pacific Daylight Time)

import { Printer } from './Printer';
// Mock console.log to avoid unnecessary logging in test environment
jest.spyOn(console, 'log').mockImplementation(() => {});
describe('Printer', function () {
  // Restoring the mocks after each test
  afterEach(() => {
    jest.clearAllMocks();
  });
  let consoleSpy: jest.SpyInstance;
  beforeEach(() => {
    // Spy on console.log before each test
    consoleSpy = jest.spyOn(console, 'log');
    consoleSpy.mockClear();
  });

  // Test cases
  it('should print the number of files if the number of files is 15 or more', () => {
    const filePaths = Array(20).fill('path/to/file');

    Printer.printFilesToTest(filePaths);

    expect(console.log).toHaveBeenCalledWith(`Generating tests for ${filePaths.length} files.`);
  });

  it('should print the intro text correctly', () => {
    Printer.printIntro();

    // Check that console.log was called with the correct arguments
    expect(consoleSpy).toHaveBeenCalledWith(Printer.LINE_DIVIDER);
    expect(consoleSpy).toHaveBeenCalledWith('##### Generating unit tests with DeepUnit.AI #####');
    expect(consoleSpy).toHaveBeenCalledWith(Printer.LINE_DIVIDER);
  });

  it('should print the correct number of files to test', () => {
    const filePaths = Array.from({ length: 20 }, (_, i) => `file${i + 1}`);

    Printer.printFilesToTest(filePaths);

    // Check that console.log was called with the correct argument
    expect(consoleSpy).toHaveBeenCalledWith(`Generating tests for ${filePaths.length} files.`);
  });

  it('should print the file paths if less than 15 files', () => {
    const filePaths = Array.from({ length: 10 }, (_, i) => `file${i + 1}`);

    Printer.printFilesToTest(filePaths);

    // Check that console.log was called with the correct arguments
    filePaths.forEach((filePath) => expect(consoleSpy).toHaveBeenCalledWith(`- ${filePath}`));
  });

  it('should print the summary correctly', () => {
    const failingTests = ['test1', 'test2'];
    const testsWithErrors = ['test3'];
    const passingTests = ['test4', 'test5', 'test6'];

    Printer.printSummary(failingTests, testsWithErrors, passingTests);

    // Check that console.log was called with the correct arguments
    expect(consoleSpy).toHaveBeenCalledWith(Printer.LINE_DIVIDER);
    expect(consoleSpy).toHaveBeenCalledWith('##### Summary of DeepUnit.AI Run #####');
    expect(consoleSpy).toHaveBeenCalledWith(Printer.LINE_DIVIDER);
    failingTests.forEach((test) => expect(consoleSpy).toHaveBeenCalledWith(`     ${test}`));
    testsWithErrors.forEach((test) => expect(consoleSpy).toHaveBeenCalledWith(`     ${test}`));
    passingTests.forEach((test) => expect(consoleSpy).toHaveBeenCalledWith(`     ${test}`));
  });

  // Test cases
  it('should print all file paths if the number of files is less than 15', () => {
    const filePaths = Array(10).fill('path/to/file');

    Printer.printFilesToTest(filePaths);

    filePaths.forEach((filePath) => {
      expect(console.log).toHaveBeenCalledWith(`- ${filePath}`);
    });
  });
});
