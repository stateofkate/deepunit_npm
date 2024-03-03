import { TestingFrameworks } from '../main.consts';
import {SingleTestRunResult} from "./testers/Tester";
import {TestCaseWithTestBed} from "../main";

export type ApiBaseData = {
  scriptTarget?: string;
  frontendFramework: string;
  frameworkVersion?: string;
  testingFramework: TestingFrameworks;
  version: string;
  email: string | null;
  platform: string | null;
  testCaseGoal?: string;
  testSuffix: string;
  useOpenAI: boolean;
  useTurbo: boolean;
};

export type GenerateTestData = {
  sourceFileDiffs: string[];
  sourceFile?: { [key: string]: string };
  testFile?: { [key: string]: string };
  testingLanguageOverride?: string;
  functionsToTest?: string[];
  testCasesObj?: { [key: string]: string };

};

export type GenerateBugReport = {
  sourceFileDiffs: string[];
  sourceFile?: { [key: string]: string };
  bugReport?: { [key: string]: string};
  testingLanguageOverride?: string;
  functionsToTest?: string [];
};

export type FeedbackData = {
  feedback: string;
  subject: string;
};

export type LogsData = {
  logs: string;
  vscode?: boolean;
};

export type FixErrorsData = {
  errorMessage: string;
  testFileName: string;
  testContent: string;
  diff: string;
  tsFileContent: string;
};


export type SendResultDataPost = {
  failedTests: { [key: string]: string },
  passedTests: { [key: string]: string },
  tests: { [key: string]: string };
  failedTestErrors: { [key: string]: string };
  sourceFileName: string;
  sourceFileContent: string;
};
export type SendIterativeResults = {
  testFileName: string;
  sourceFileName: string;
  singleTestRunResult: SingleTestRunResult;
  sourceFileContent: string;
  lastIterativeresultId?: any;
  currentTest: TestCaseWithTestBed;
  testFileContent: string
}
export type SendAnalyticsData = {
  logMessage: string;
  vscode?: boolean;
};

export type SendBugAnalyticsData = {
  logMessage: string;
  scriptTarget: string;
};

export type SendBugResults = {
  bugReport: string;
  bugReportName: string;
  sourceFileName: string;
  sourceFileContent: string;
}
