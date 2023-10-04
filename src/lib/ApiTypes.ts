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
  testFiles: string[];
  prettierConfig?: Object;
  testFileContent: string;
};
export type SendResultData = {
  failedTests: string[];
  passedTests: string[];
  tests: Record<string, string>;
};
