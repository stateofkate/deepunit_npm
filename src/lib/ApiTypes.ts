import { TestingFrameworks } from '../main.consts';

export type ApiBaseData = {
  frontendFramework: string;
  testingFramework: TestingFrameworks;
  version: string;
  email: string | null;
};

export type GenerateTestData = {
  diffs: string;
  sourceFile?: { [key: string]: string };
  testFile?: { [key: string]: string };
  testingLanguageOverride?: string;
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
  failedTests: string[];
  includeFailingTests: boolean;
  scriptTarget: string;
};
export type SendResultData = {
  failedTests: string[];
  passedTests: string[];
  tests: Record<string, string>;
  failedTestErrors: any;
  scriptTarget: string;
};
