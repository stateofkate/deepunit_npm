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
  testFiles: string[];
  prettierConfig?: Object;
};
