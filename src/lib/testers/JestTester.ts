import { ExecException, exec, execSync } from 'child_process';
import {JestTestRunResult, TestRunResult, Tester, SingleTestRunResult} from './Tester';
import {Api, ClientCode} from "../Api";
import {exitWithError} from "../utils";
import {string} from "yargs";
import fs from "../vsfs";
import console, {Log} from '../Log';
export const logAnchor = console.anchor


export class JestTester extends Tester {
  public async runSingleTest(testFilePath: string): Promise<SingleTestRunResult> {
    const testResult = this.runTest(testFilePath)
  
    if (testResult.testFailedWithError || !testResult.jestResult || !testResult.jestResult.success) {
      // if an error happened when running the test
      const resultParsed: SingleTestRunResult = {
        passed: false,
        testFailureStack: testResult.testFailedWithError.stack
      }
      return resultParsed
    } else {
      if (testResult.jestResult?.testResults[0]?.status == 'passed') {
        const resultParsed: SingleTestRunResult = {
          passed: true,
        }
        return resultParsed
      } else {
        const resultParsed: SingleTestRunResult = {
          passed: false,
          testFailureStack: testResult.jestResult.stack
        }
        return resultParsed
      }
    }
  }

  public runTest(filePath: string): JestTestRunResult {
    let testResult: JestTestRunResult = {
      file: filePath,
      testFailedWithError: undefined,
      jestResult: undefined,
    };
    
    try {
      const result = execSync(`npx jest --json --no-colors ${filePath} --passWithNoTests --runInBand`).toString();
      if (result) {
        const jsonParts = JestTester.extractJSONs(result);
        testResult.jestResult = jsonParts.length > 0 ? JSON.parse(jsonParts[0]) : JSON.parse(result);
      } else {
        testResult.testFailedWithError = 'Did not get result from jest exec command';
      }
    } catch (error) {
      testResult.testFailedWithError = error as string;
    }
    
    return testResult;
  }
  
  
  public static extractJSONs(text: string) {
    let results = [];
    let stack = [];
    let startIdx = 0;
    let insideString = false; // Flag to indicate whether we are inside a JSON string
    let quoteChar = ''; // To store the type of quote (single or double)
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if ((char === '"' || char === "'") && stack.length > 0 && (i === 0 || text[i - 1] !== '\\')) {
        // Check if we're entering or leaving a JSON string
        if (insideString) {
          // We're possibly leaving a JSON string, but only if the char matches the starting quote
          if (char === quoteChar) {
            insideString = false;
            quoteChar = '';
          }
        } else {
          // We're entering a JSON string
          insideString = true;
          quoteChar = char;
        }
      }
      // If inside a string, ignore other characters
      if (insideString) {
        continue;
      }
      if (char === '{') {
        stack.push('{');
        if (stack.length === 1) {
          // Remember the index where the JSON string started
          startIdx = i;
        }
      } else if (char === '}') {
        if (stack.length === 0) {
          // unmatched }, ignore
          continue;
        }
        stack.pop();
        if (stack.length === 0) {
          // Complete JSON found, extract substring
          results.push(text.slice(startIdx, i + 1));
        }
      }
    }
    return results;
  }
}
