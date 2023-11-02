import fs from 'fs';
import { multiply } from './testUtils';
import { checkIfFileExists } from './subfolder/file';
import { SMALL_NUMBER } from './subfolder/consts/tests.consts';
import * as path from 'path';

// @deep-unit-ignore-next-line
export function checkFileIsNotEmpty(filePath: string): boolean {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return fileContent.trim() !== ''; // Check if the trimmed content is not empty
  } catch (error) {
    return false; // Return false if there's an error reading the file
  }
}

export function confirmFileIsWithinFolder(filePath: string, folderPath: string): boolean {
  // Check if the file exists
  const doesExist = fs.existsSync(filePath);
  if (!doesExist) {
    return false;
  }

  // Resolve the absolute path of the file and the folder
  const absoluteFilePath = path.resolve(filePath);
  const absoluteFolderPath = path.resolve(folderPath);

  // Check if the file is within the folder
  return absoluteFilePath.startsWith(absoluteFolderPath);
}

// math utility to square a number
export function squareNumber(num: number): number {
  return multiply(num, num);
}

export function factorial(n: number): number {
  if (n < 0) throw new Error('Negative numbers do not have a factorial');
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}

export function isPrime(n: number): boolean {
  if (n <= 1) return false;
  if (n <= 3) return true;

  if (n % 2 === 0 || n % 3 === 0) return false;

  let i = 5;
  while (i * i <= n) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
    i += 6;
  }
  return true;
}

export function gcd(a: number, b: number): number {
  if (!b) return a;
  return gcd(b, a % b);
}

export function fibonacci(n: number): number {
  if (n < 0) throw Error('Not a valid number');
  if (n <= 1) return n;
  let a = 0,
    b = 1,
    next;
  for (let i = 2; i <= n; i++) {
    next = a + b;
    a = b;
    b = next;
  }
  return b;
}

export function circleArea(radius: number): number {
  if (radius < 0) throw new Error('Radius cannot be negative');
  return Math.PI * Math.pow(radius, 2);
}

export function is32Bit(num: number): boolean {
  if (num > 2_147_483_647) {
    return false;
  }

  return true;
}
