export const jsonObject = `
  This is some text before it "Haha:
{
  numFailedTestSuites: 1,
  numFailedTests: 0,
  numPassedTestSuites: 0,
  numPassedTests: 0,
  numPendingTestSuites: 0,
  numPendingTests: 0,
  numRuntimeErrorTestSuites: 1,
  numTodoTests: 0,
  numTotalTestSuites: 1,
  numTotalTests: 0,
  openHandles: [],
  snapshot: {
    updated: 0,
  },
  startTime: 1697604424221,
  success: false,
  testResults: [
    {
      assertionResults: [],
      coverage: {},
      endTime: 1697604425049,
      message:
        "[1m● [22mTest suite failed to run\n\n   [96msrc/other.deepunitai.test.ts[0m:[93m124[0m:[93m13[0m - [91merror[0m[90m TS2304: [0mCannot find name 'other'.\n\n    [7m124[0m       await other();\n    [7m   [0m [91m            ~~~~[0m\n",
      name: '/Users/justinstrong/captain-hook/src/other.deepunitai.test.ts',
      startTime: 1697604425049,
      status: 'failed',
      summary: '',
    },
  ],
  wasInterrupted: false,
}
and this is some text after
`;

export const expectedJsonObject = `{
  numFailedTestSuites: 1,
  numFailedTests: 0,
  numPassedTestSuites: 0,
  numPassedTests: 0,
  numPendingTestSuites: 0,
  numPendingTests: 0,
  numRuntimeErrorTestSuites: 1,
  numTodoTests: 0,
  numTotalTestSuites: 1,
  numTotalTests: 0,
  openHandles: [],
  snapshot: {
    updated: 0,
  },
  startTime: 1697604424221,
  success: false,
  testResults: [
    {
      assertionResults: [],
      coverage: {},
      endTime: 1697604425049,
      message:
        "[1m● [22mTest suite failed to run\n\n   [96msrc/other.deepunitai.test.ts[0m:[93m124[0m:[93m13[0m - [91merror[0m[90m TS2304: [0mCannot find name 'other'.\n\n    [7m124[0m       await other();\n    [7m   [0m [91m            ~~~~[0m\n",
      name: '/Users/justinstrong/captain-hook/src/other.deepunitai.test.ts',
      startTime: 1697604425049,
      status: 'failed',
      summary: '',
    },
  ],
  wasInterrupted: false,
}`;
