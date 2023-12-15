import { TestingFrameworks } from '../main.consts';

export type ApiBaseData = {
  frontendFramework: string;
  testingFramework: TestingFrameworks;
  version: string;
  email: string | null;
  platform: string | null;
};

export type GenerateTestData = {
  sourceFileDiffs: string;
  sourceFile?: { [key: string]: string };
  testFile?: { [key: string]: string };
  testingLanguageOverride?: string;
  functionsToTest?: string[];
  testCasesObj?: { [key: string]: string };

};

export type GenerateBugReport = {
  sourceFileDiffs: string;
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

export type RecombineTestData = {
  testFiles: { [key: string]: string };
  prettierConfig?: Object;
  testFileContent: string;
  failedItBlocks: { [key: string]: string[] };
  failedTests: Record<string,string>
  includeFailingTests: boolean;
  scriptTarget: string;
};


export type SendResultDataPost = {
  failedTests: Record<string, string>,
  passedTests: Record<string, string>,
  tests: Record<string, string>;
  failedTestErrors: { [key: string]: string };
  scriptTarget: string;
  sourceFileName: string;
  sourceFileContent: string;
};
export type SendAnalyticsData = {
  logMessage: string;
  scriptTarget: string;
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
  scriptTarget: string;
}
