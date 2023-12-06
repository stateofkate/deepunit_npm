import axios, { AxiosError } from 'axios';
import { AUTH } from '../main';
import { mockedGenerationConst } from '../main.consts';
import { checkVSCodeFlag, debugMsg, exitWithError } from './utils';
import {
  SendBugAnalyticsData,
  ApiBaseData,
  FixErrorsData,
  GenerateBugReport,
  GenerateTestData,
  RecombineTestData,
  SendAnalyticsData,
  SendBugResults,
  SendResultDataPost,
  FeedbackData,
  LogsData,
} from './ApiTypes';
import { CONFIG } from './Config';
import { GenerateTestOrReportInput } from './testers/Tester';

enum ApiPaths {
  generate = '/generate-test/new',
  fixErrors = '/generate-test/fix-many-errors',
  recombineTests = '/generate-test/recombine-tests',
  sendResults = '/generate-test/send-results',
  sendAnalytics = '/generate-test/send-analytics',
  getLatestVersion = '/generate-test/get-latest-version',
  feedback = '/feedback/feedback',
  logs = '/feedback/logs',
  generateBugReport = '/generate-bug-report/bug-new',
  sendBugResults = '/generate-bug-report/send-bug-results',
  sendBugAnalytics = '/generate-bug-report/send-bug-analytics',
}
export enum StateCode {
  'Success' = 0,
  'FileNotSupported' = 1,
  'FileFullyTested' = 2,
}

export enum ClientCode {
  ClientExited = 'ClientExited',
  ClientErrored = 'ClientErrored',
}


const apiPath = (path: ApiPaths | string) => `${CONFIG.apiHost}${path}`;

let mockGenerationApiResponse: boolean = false;

export class Api {
  public static async post<T>(path: ApiPaths | string, customData?: T) {
    const headers = {'Content-Type': 'application/json'};

    let data: ApiBaseData = {
      frontendFramework: CONFIG.frontendFramework,
      testingFramework: CONFIG.testingFramework,
      version: await CONFIG.getVersion(),
      email: AUTH.getEmail(),
      platform: CONFIG.platform,
      ...customData,
    };

    try {
      const apiPathToCall = apiPath(path);
      debugMsg(`POST REQUEST ${apiPathToCall}`, data);
      const response = mockGenerationApiResponse ? mockedGenerationConst : await axios.post(apiPathToCall, data, {headers});
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    } catch (error: any) {
      if ((error as AxiosError).code == 'ECONNREFUSED') {
        return await exitWithError('Unable to connect to server, sorry for the inconvenience. Please try again.');
      }
      console.error(`Request Failed with error: ${error}`);
      return {httpError: error?.response?.data?.statusCode, errorMessage: error?.response?.data?.message};
    }
  }


  public static async generateTest(generateTestInput: GenerateTestOrReportInput): Promise<any> {
    if (!generateTestInput.sourceFileName || !generateTestInput.sourceFileContent) {
      return await exitWithError('Source file is required to exist with valid content in order to run DeepUnitAi');
    }
    let data: GenerateTestData = {
      sourceFileDiffs: generateTestInput.sourceFileDiff,
      sourceFile: { [generateTestInput.sourceFileName]: generateTestInput.sourceFileContent },
    };

    if(generateTestInput.testCasesObj) {
      data.testCasesObj = generateTestInput.testCasesObj;
    }

    if (CONFIG.testingLanguageOverride) {
      data.testingLanguageOverride = CONFIG.testingLanguageOverride;
    }
    if (generateTestInput.generatedFileName || generateTestInput.generatedFileContent) {
      // test file is optional
      data.testFile = { [generateTestInput.generatedFileName]: generateTestInput.generatedFileContent };
    }
    if (generateTestInput.functionsToTest) {
      data.functionsToTest = generateTestInput.functionsToTest;
    }

    return await this.post(ApiPaths.generate, data);
  }

  public static async generateBugReport(

    generateTestInput: GenerateTestOrReportInput
  ): Promise<any> {
    if (!generateTestInput.sourceFileName || !generateTestInput.sourceFileContent) {
      return exitWithError('Source file is required to exist with valid content in order to run DeepUnitAi');
    }
    let data: GenerateBugReport = {
      sourceFileDiffs: generateTestInput.sourceFileDiff,
      sourceFile: { [generateTestInput.sourceFileName]: generateTestInput.sourceFileContent},
    };

    if (CONFIG.testingLanguageOverride) {
      data.testingLanguageOverride = CONFIG.testingLanguageOverride;
    }

    if (generateTestInput.generatedFileName || generateTestInput.generatedFileContent) {
      // test file is optional
      data.bugReport = { [generateTestInput.generatedFileName]: generateTestInput.generatedFileContent };
    }
    if (generateTestInput.functionsToTest) {
      data.functionsToTest = generateTestInput.functionsToTest;
    }

    return await this.post(ApiPaths.generateBugReport, data);
}

  public static async fixErrors(errorMessage: string, testFileName: string, testContent: string, diff: string, tsFileContent: string): Promise<undefined | any> {
    const data: FixErrorsData = {
      errorMessage,
      testFileName,
      testContent,
      diff,
      tsFileContent,
    };

    return await this.post(ApiPaths.fixErrors, data);
  }

  public static async recombineTests(
    tempTests: { [key: string]: string },
    testFileContent: string,
    failedItBlocks: { [key: string]: string[] },
    failedTests: string[],
    prettierConfig: Object | undefined,
  ) {
    let data: RecombineTestData = {
      testFiles: tempTests,
      testFileContent: testFileContent,
      failedItBlocks,
      failedTests,
      includeFailingTests: CONFIG.includeFailingTests,
      scriptTarget: CONFIG.scriptTarget,
    };

    if (prettierConfig) {
      data['prettierConfig'] = prettierConfig;
    }

    return await this.post(ApiPaths.recombineTests, data);
  }

  public static async sendResults(
      failedTests: string[],
      passedTests: string[],
      tests: Record<string, string>,
      failedTestErrors: any,
      sourceFileName: string,
      sourceFileContent: string,
      promptInputRecord: Record<string, string>,
      modelTextResponseRecord: Record<string, string>,
  ) {
    const data: SendResultDataPost = {
      failedTests,
      passedTests,
      tests,
      failedTestErrors,
      sourceFileName,
      sourceFileContent,
      promptInputRecord,
      modelTextResponseRecord,
      scriptTarget: CONFIG.scriptTarget,
    };
    await this.post(ApiPaths.sendResults, data);
  }

  public static async sendBugResults(
    bugReport: string,
    bugReportName: string,
    sourceFileName: string,
    sourceFileContent: string,
  ) {
    const data: SendBugResults = {
      bugReport,
      bugReportName,
      sourceFileName,
      sourceFileContent,
      scriptTarget: CONFIG.scriptTarget,
    };
    await this.post(ApiPaths.sendBugResults, data);
  }

  public static async sendAnalytics(message: string, clientCode: ClientCode) {
    const data: SendAnalyticsData = {
      logMessage: message,
      scriptTarget: CONFIG.scriptTarget,
      vscode: checkVSCodeFlag(),
    };
    await this.post(ApiPaths.sendAnalytics + '/?code=' + clientCode, data);
  }

  public static async getLatestVersion(): Promise<{ latestVersion: string }> {
    return await this.post(ApiPaths.getLatestVersion);
  }

  public static async Feedback(userFeedback: string, subject: string): Promise<void> {
    const data: FeedbackData = {
      feedback: userFeedback,
      subject,
    };
    return await this.post(ApiPaths.feedback, data);
  }

  public static async SendLogs(logs: string): Promise<void> {
    const data: LogsData = {
      logs: logs,
      vscode: checkVSCodeFlag(),
    };
    return await this.post(ApiPaths.logs, data);
  }
}
