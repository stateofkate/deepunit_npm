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
    console.log('result:', result);
  });
  it('should get latest file content', () => {
    const sourceFileName = '/Users/kateyeh/DeepUnit/captain-hook/src/lib/Files.ts';
    const sourceFileContent = Files.getFileContent(sourceFileName);
    console.log('sourceFileContent:', sourceFileContent);
  })
  //

})
