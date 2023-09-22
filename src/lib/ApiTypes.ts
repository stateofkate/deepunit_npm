export type GenerateTestData = {
  diffs: string;
  tsFile?: { [key: string]: string };
  htmlFile?: { [key: string]: string };
  testFile?: { [key: string]: string };
};

export type FixErrorsData = {
  errorMessage: string;
  testFileName: string;
  testContent: string;
  diff: string;
  tsFileContent: string;
};

export type RecombineTestData = {
  testFiles: { [key: string]: string[] };
  prettierConfig?: Object;
  testFileContent: string;
};
