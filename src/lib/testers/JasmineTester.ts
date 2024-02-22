import { ExecException, exec, execSync } from 'child_process';
import {JestTestRunResult, TestRunResult, Tester, SingleTestRunResult} from './Tester';
import {Api, ClientCode} from "../Api";
import Config from "../Config";
import fs from "../vsfs";
export const anchor = fs.anchor;
import console, {Log} from '../Log';
export const logAnchor = console.anchor


export class JasmineTester extends Tester {
  public async runTests(relativePathArray: string[]): Promise<JestTestRunResult[]> {
    return []
  }
  
  public async runSingleTest(testFilePath: string): Promise<SingleTestRunResult> {
    try {
      if (testFilePath.startsWith('passport/')) {
        testFilePath = testFilePath.substring('passport/'.length);
      }
      let command = `ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${testFilePath}`;
      const CONFIG = new Config()
      if(CONFIG.prodTesting) {
        command = `cd passport && ` + command
      }
    
      // Execute the command and capture the output
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    
      return { passed: true }; // Return output when tests passed
    } catch (error) {
      const errorToDisplay = error.stdout.split('FAILED')[1] ? error.stdout.split('FAILED')[1] : error.stdout
      return {
        passed: false,
        testFailureStack: errorToDisplay//todo: make sure this is the only type of test failure possible. Off the top of my head we could have a failure due to uncompilable code, or failing assertions and perhaps even more.
      };
    }
  }


}
