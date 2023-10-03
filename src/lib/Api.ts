import axios, { AxiosError } from 'axios';
import { AUTH, CONFIG } from '../main';
import { TestingFrameworks, mockedGenerationConst } from '../main.consts';
import { debugMsg, exitWithError } from './utils';
import { FixErrorsData, GenerateTestData, RecombineTestData, SendResultData } from './ApiTypes';

type ApiBaseData = {
  frontendFramework: string;
  testingFramework: TestingFrameworks;
  scriptTarget: string;
  version: string;
  password: string;
  email: string | null;
};

enum ApiPaths {
  generate = '/generate-test/new',
  fixErrors = '/generate-test/fix-many-errors',
  recombineTests = '/generate-test/recombine-tests',
  sendResults = '/generate-test/send-results',
  getLatestVersion = '/generate-test/get-latest-version',
}
export enum StateCode {
  'Success' = 0,
  'WrongPassword' = 1,
  'FileNotSupported' = 2,
  'FileFullyTested' = 3,
}
const apiPath = (path: ApiPaths) => `${CONFIG.apiHost}${path}`;

let mockGenerationApiResponse: boolean = false;

export class Api {
  public static async post<T>(path: ApiPaths, customData?: T) {
    const headers = { 'Content-Type': 'application/json' };

    let data: ApiBaseData = {
      frontendFramework: CONFIG.frontendFramework,
      testingFramework: CONFIG.testingFramework,
      scriptTarget: CONFIG.scriptTarget,
      version: CONFIG.version,
      password: CONFIG.password,
      email: AUTH.getEmail(),
      ...customData,
    };

    try {
      const apiPathToCall = apiPath(path);
      debugMsg(`POST REQUEST ${apiPathToCall}`, data);
      const response = mockGenerationApiResponse ? mockedGenerationConst : await axios.post(apiPathToCall, data, { headers });
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    } catch (error: any) {
      if ((error as AxiosError).code == 'ECONNREFUSED') {
        exitWithError('Unable to connect to server, sorry for the inconvenience. Please try again.');
      }
      console.error(`Request Failed with error: ${error}`);
      return { httpError: error?.response?.data?.statusCode, errorMessage: error?.response?.data?.message };
    }
  }

  public static async generateTest(diffs: string, sourceFileName: string | null, sourceFileContent: string | null, testFileName: string, testFileContent: string): Promise<any> {
    if (!sourceFileName || !sourceFileContent) {
      return exitWithError('Source file is required to exist with valid content in order to run DeepUnitAi');
    }
    let data: GenerateTestData = {
      diffs,
      sourceFile: { [sourceFileName]: sourceFileContent },
    };

    if (CONFIG.testingLanguageOverride) {
      data.testingLanguageOverride = CONFIG.testingLanguageOverride;
    }
    if (testFileName || testFileContent) {
      // test file is optional
      data.testFile = { [testFileName]: testFileContent };
    }

    return await this.post(ApiPaths.generate, data);
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

  public static async recombineTests(testContents: string[], testFileContent: string, prettierConfig: Object | undefined) {
    let data: RecombineTestData = {
      testFiles: testContents,
      testFileContent: testFileContent,
    };

    if (prettierConfig) {
      data['prettierConfig'] = prettierConfig;
    }

    return await this.post(ApiPaths.recombineTests, data);
  }

  public static sendResults(failedTests: string[], passedTests: string[], tests: Record<string, string>) {
    const data: SendResultData = {
      failedTests,
      passedTests,
      tests,
    };
    this.post(ApiPaths.sendResults, data);
  }

  public static async getLatestVersion(): Promise<{ latestVersion: string }> {
    return this.post(ApiPaths.getLatestVersion);
  }
}
