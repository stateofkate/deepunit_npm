import { Files } from './Files'
import { execSync } from 'child_process';
import * as fs from 'fs';
import path from 'path';
import { CONFIG } from './Config';
import {
  exitWithError,
  getAbsolutePathsFlag,
  getBugFileFlag,
  getBugFlag,
  getForceFilter,
  getFilesFlag,
  getGenerateAllFilesFlag,
  getPatternFlag,
  setupYargs,
  getYesOrNoAnswer, askQuestion, getTargetBranchFlagFlag
} from './utils';
import * as glob from 'glob';
import { Color } from './Printer';


describe('getDiff', () => {
  fit('should parse diffs', async() => {
    const result = await Files.getDiff(['/Users/kateyeh/DeepUnit/captain-hook/src/lib/Files.ts']);
    const expected: string[] = [
      ' \'diff --git a/src/lib/Files.ts b/src/lib/Files.ts\\n\' +\n' +
      '        \'index 114db7d..fd89cdc 100644\\n\' +\n' +
      '        \'--- a/src/lib/Files.ts\\n\' +\n' +
      '        \'+++ b/src/lib/Files.ts\\n\' +\n' +
      '        \'@@ -24 +23,0 @@ export class Files {\\n\' +\n' +
      '        \'-\\n\' +\n' +
      '        \'@@ -187 +186 @@ export class Files {\\n\' +\n' +
      '        \'-  public static hasUncommittedChanges(files: string[]) {\\n\' +\n' +
      '        \'+  public static hasUncommittedChanges(files: string[], targetBranch: string, remoteName: string) {\\n\' +\n' +
      '        \'@@ -189 +188 @@ export class Files {\\n\' +\n' +
      '        "-      const status = execSync(`git status --porcelain -- ${files.join(\' \')}`).toString();\\n" +\n' +
      '        "+      const status = execSync(`git status ${remoteName}/${targetBranch} --porcelain -- ${files.join(\' \')}`).toString();\\n" +\n' +
      '        \'@@ -195,0 +195 @@ export class Files {\\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -196,0 +197,13 @@ export class Files {\\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'+    /*\\n\' +\n' +
      '        \'+    scenarios:\\n\' +\n' +
      '        \'+    1. We are in github/gitlab action and want to get diffs of the submitted pull request commit vs the target branch commit, i.e. committed changes against committed changes\\n\' +\n' +
      '        \'+    2. We are in VS code / npm package and want to get diffs of the working file vs the target branch commit, i.e. committed changes of current working file, as well as staged and unstaged changes\\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'+    Some notes on git commands:\\n\' +\n' +
      '        \'+    1. git diff (without any arguments): Shows the differences between the working directory and the index (staging area). This means it only shows unstaged changes.\\n\' +\n' +
      '        \'+  \\t2. git diff --staged or git diff --cached: Shows the differences between the index (staging area) and the last commit (HEAD). This means it only shows staged changes.\\n\' +\n' +
      '        "+  \\t3. git diff HEAD: Shows the differences between the working directory (both staged and unstaged changes) and the last commit (HEAD). This is why you\'re seeing both staged and unstaged changes with this command.\\n" +\n' +
      '        \'+  \\t4. git diff origin/dev..HEAD: Compares the state of the repository at origin/dev with HEAD. This command only shows changes that have been committed between these two points. Unstaged and staged (but not yet committed) changes in your working directory are not included in this comparison.\\n\' +\n' +
      '        \'+     */\\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -201 +214 @@ export class Files {\\n\' +\n' +
      '        \'-  \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -213 +226,2 @@ export class Files {\\n\' +\n' +
      '        "-      diffCmd.push(`git diff origin/${targetBranch}..HEAD -U0 -- ${files.join(\' \')}`);\\n" +\n' +
      '        \'+      //github/gitlab action\\n\' +\n' +
      '        "+      diffCmd.push(`git diff ${remoteName}/${targetBranch}..HEAD -U0 -- ${files.join(\' \')}`);\\n" +\n' +
      '        \'@@ -215,7 +229,5 @@ export class Files {\\n\' +\n' +
      '        \'-      if(this.hasUncommittedChanges(files)) {\\n\' +\n' +
      '        "-        //diffCmd.push(`git diff -U0 --staged -- ${files.join(\' \')}`) someday we should support staged changes, but not a priority rn\\n" +\n' +
      '        "-        diffCmd.push(`git diff -U0 -- ${files.join(\' \')}`)\\n" +\n' +
      '        \'-      } else {\\n\' +\n' +
      '        "-        diffCmd.push(`git diff origin/${targetBranch}..HEAD -U0 -- ${files.join(\' \')}`);\\n" +\n' +
      '        \'-      }\\n\' +\n' +
      '        \'-      \\n\' +\n' +
      '        \'+      // we are in npm package/VS code\\n\' +\n' +
      '        \'+      // this shows committed changes between this branch vs target branch:\\n\' +\n' +
      '        "+      diffCmd.push(`git diff ${remoteName}/${targetBranch}..HEAD -U0 -- ${files.join(\' \')}`);\\n" +\n' +
      '        \'+      // this shows unstaged and staged changes\\n\' +\n' +
      '        "+      diffCmd.push(`git diff HEAD -U0 -- ${files.join(\' \')}`)\\n" +\n' +
      '        \'@@ -231 +243 @@ export class Files {\\n\' +\n' +
      '        \'-  \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -264 +276 @@ export class Files {\\n\' +\n' +
      '        \'-    \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -269 +281 @@ export class Files {\\n\' +\n' +
      '        \'-    \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -271 +283 @@ export class Files {\\n\' +\n' +
      '        \'-    \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -304,0 +317 @@ export class Files {\\n\' +\n' +
      '        "+    console.log(\'random console log here\');\\n" +\n' +
      '        \'@@ -487 +500 @@ export class Files {\\n\' +\n' +
      '        \'-  \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -490 +503 @@ export class Files {\\n\' +\n' +
      '        \'-    \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -496 +509 @@ export class Files {\\n\' +\n' +
      '        \'-    \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -499 +512 @@ export class Files {\\n\' +\n' +
      '        \'-    \\n\' +\n' +
      '        \'+\\n\' +\n' +
      '        \'@@ -502 +515 @@ export class Files {\\n\' +\n' +
      '        \'-    \\n\' +\n' +
      '        \'+\\n\'\n'
    ]
    expect(result).toEqual(expected);
  });
})
