import { CONFIG } from '../Config';
import {Api, ClientCode} from '../Api';
import { Files } from '../Files';
import { LoadingIndicator, getJsonFlag } from '../utils';
import console from '../Log';
import fs from "fs";
import {TestCaseWithTestBed} from "../../main";

export interface SingleTestRunResult {
  passed: boolean;
  testFailureStack?: string;
}
export interface TestRunResult {
  passedTests: { [key: string]: string };
  failedTests: { [key: string]: string };
  failedTestErrors: { [key: string]: string };
  /**
   * Key: FileName
   * Value: List of failing it blocks
   */
  failedItBlocks: { [key: string]: string[] };
  itBlocksCount: { [key: string]: number };
}


export interface GenerateTestOrReportInput {
  sourceFileDiff: string[];
  sourceFileName: string | null;
  sourceFileContent: string | null;
  generatedFileName: string;
  generatedFileContent: string;
  functionsToTest?: string[];
  testCasesObj?: { [key: string]: string };
}
export interface RemoveFailedTestInput {
  failedTest: TestCaseWithTestBed;
  lastPassingTest: TestCaseWithTestBed;
  unfinishedTests: TestCaseWithTestBed[]
}

export type JestTestRunResult = {
  file: string;
  testFailedWithError: any;
  jestResult: undefined | any;
};


export abstract class Tester {
  public static getTestName(file: string): string {
    const fileParts = file.split('.');
    const fileExt = fileParts[fileParts.length - 1];
    const configTestFile = fileParts.slice(0, -1).join('.') + '.' + CONFIG.testSuffix + '.' + fileExt;
  
    if(fs.existsSync(configTestFile)) {
      return configTestFile
    }
    const testExtensionFile = fileParts.slice(0, -1).join('.') + '.test.' + fileExt;
    if(fs.existsSync(testExtensionFile)) {
      return testExtensionFile
    }
    const specExtensionFile = fileParts.slice(0, -1).join('.') + '.spec.' + fileExt;
    if(fs.existsSync(specExtensionFile)) {
      return specExtensionFile
    }
    const deepunitTestFile = fileParts.slice(0, -1).join('.') + '.deepunitai.' + CONFIG.testSuffix + '.' + fileExt;
    return deepunitTestFile;
  }

  public static getBugReportName(file: string): string {
    const fileParts = file.split('.');
    const fileExt = 'md';
    const testFileName = fileParts.slice(0, -1).join('.') + '.deepunit_bugreport.' + CONFIG.testSuffix + '.' + fileExt;
    return testFileName;
  }

  /**
   * Check if the test works in the framework
   * @param files
   */
  public abstract getTestResults(files: string[]): Promise<TestRunResult>;
  public abstract runSingleTest(filePath: string): Promise<SingleTestRunResult>;
}
