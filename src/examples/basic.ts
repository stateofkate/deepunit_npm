import fs from 'fs';
import { multiply } from './testUtils';
import { checkIfFileExists } from './subfolder/file';
import { SMALL_NUMBER } from './subfolder/consts/myConsts';

// base logic
export function testFunction(arg: number): number {
  let test1 = SMALL_NUMBER;
  if (arg > 5) {
    return test1 - arg;
  } else {
    return test1 + arg;
  }
}

export function checkFileIsNotEmpty(filePath: string): boolean {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return fileContent.trim() !== ''; // Check if the trimmed content is not empty
  } catch (error) {
    return false; // Return false if there's an error reading the file
  }
}

export function confirmFiles(filePath: string): boolean {
  return checkIfFileExists(filePath);
}

export function squareNumber(num: number): number {
  return multiply(num, num);
}
