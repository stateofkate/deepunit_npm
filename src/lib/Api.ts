import axios, { AxiosError } from 'axios';
import { CONFIG } from './Config';
import { TestingFrameworks, mockedGenerationConst } from '../main.consts';
import { debugMsg, exitWithError } from './utils';
import { FixErrorsData, GenerateTestData, RecombineTestData } from './ApiTypes';

type ApiBaseData = {
  frontendFramework: string;
  testingFramework: TestingFrameworks;
  scriptTarget: string;
  version: string;
  password: string;
};

enum ApiPaths {
  generate = '/generate-test/new',
  fixErrors = '/generate-test/fix-many-errors',
  recombineTests = '/generate-test/recombine-tests',
}

const apiPath = (path: ApiPaths) => `${CONFIG.apiHost}${path}`;

let mockGenerationApiResponse: boolean = false;

export class Api {
  public static async post<T>(path: ApiPaths, customData: T) {
    const headers = { 'Content-Type': 'application/json' };

    let data: ApiBaseData = {
      frontendFramework: CONFIG.frontendFramework,
      testingFramework: CONFIG.testingFramework,
      scriptTarget: CONFIG.scriptTarget,
      version: CONFIG.version,
      password: CONFIG.password,
      ...customData,
    };

    try {
      debugMsg(`POST REQUEST ${path}`, data);
      const response = mockGenerationApiResponse ? mockedGenerationConst : await axios.post(apiPath(path), data, { headers });
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      return response.data;
    } catch (error) {
      if ((error as AxiosError).code == 'ECONNREFUSED') {
        exitWithError('Unable to connect to server, sorry for the inconvenience. Please try again.');
      }
      console.error(`Request Failed with error: ${error}`);
      return undefined;
    }
  }

  public static async generateTest(
    diffs: string,
    tsFile: string | null,
    tsFileContent: string | null,
    htmlFile: string | null,
    htmlFileContent: string | null,
    testFile: string,
    testContent: string,
  ): Promise<any> {
    let data: GenerateTestData = {
      diffs,
    };
    if (tsFile && tsFileContent) {
      data.tsFile = { [tsFile]: tsFileContent };
    }
    if (htmlFile && htmlFileContent) {
      data.htmlFile = { [htmlFile]: htmlFileContent };
    }
    if (testFile || testContent) {
      data.testFile = { [testFile]: testContent };
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

  public static async recombineTests(testContents: string[], prettierConfig: Object | undefined) {
    let data: RecombineTestData = {
      testFiles: testContents,
    };

    if (prettierConfig) {
      data['prettierConfig'] = prettierConfig;
    }

    return await this.post(ApiPaths.recombineTests, data);
  }
}
