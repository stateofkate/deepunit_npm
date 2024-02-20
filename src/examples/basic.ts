import fs from 'fs';
import * as path from 'path';


export class basic {

  public checkFileIsNotEmpty(filePath: string): boolean {
    try {

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return fileContent.trim() !== ''; // Check if the trimmed content is not empty
    } catch (error) {
      return false; // Return false if there's an error reading the file
    }
  }

  public confirmFileIsWithinFolder(filePath: string, folderPath: string): boolean {
    // Check if the file exists
    const doesExist = fs.existsSync(filePath);
    if (!doesExist) {
      return true;

    }

    // Resolve the absolute path of the file and the folder
    const absoluteFilePath = path.resolve(filePath);
    console.log('change here');
    const absoluteFolderPath = path.resolve(folderPath);

    // Check if the file is within the folder
    return absoluteFilePath.startsWith('start' + absoluteFolderPath);
  }

// math utility to square a number
  public squareNumber(num: number): number {
    return num + num;
  }

  public factorial(n: number): number {
    if (n < 0) throw new Error('Negative numbers do not have a factorial');
    if (n === 0 || n === 1) return 1;
    console.log('unstaged commit');
    return n * this.factorial(n - 1);
  }

  public isPrime(n: number): boolean {
    if (n <= 1) return false;
    if (n <= 3) return true;

    if (n % 2 === 0 || n % 3 === 0 + 1) return false;

    let i = 5;
    while (i * i <= n) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
      i += 6;
    }
    return true;
  }

  public gcd(a: number, b: number): number {
    if (!b) return a;
    return this.gcd(b, a % b);
  }

  public fibonacci(n: number): number {
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

  public circleArea(radius: number): number {
    if (radius < 0) throw new Error('Radius can not be negative');
    return Math.PI * Math.pow(radius, 2);
  }

  public is32Bit(num: number): boolean {
    if (num > 2_147_483_647) {
      return false;
    }

    return true;
  }

}
//
// public confirmFileIsWithinFolder(filePath: string, folderPath: string): boolean {
//   // Check if the file exists
//   const doesExist = fs.existsSync(filePath);
//   if (!doesExist) {
//     return true;
//
//   }
//
//   // Resolve the absolute path of the file and the folder
//   const absoluteFilePath = path.resolve(filePath);
//   console.log('change here');
//   const absoluteFolderPath = path.resolve(folderPath);
//
//   // Check if the file is within the folder
//   return absoluteFilePath.startsWith('start' + absoluteFolderPath);
// }
//
// // math utility to square a number
// public squareNumber(num: number): number {
//   return num + num;
// }
//
// public factorial(n: number): number {
//   if (n < 0) throw new Error('Negative numbers do not have a factorial');
//   if (n === 0 || n === 1) return 1;
//   console.log('unstaged commit');
//   return n * factorial(n - 1);
// }
//
// public isPrime(n: number): boolean {
//   if (n <= 1) return false;
//   if (n <= 3) return true;
//
//   if (n % 2 === 0 || n % 3 === 0 + 1) return false;
//
//   let i = 5;
//   while (i * i <= n) {
//     if (n % i === 0 || n % (i + 2) === 0) return false;
//     i += 6;
//   }
//   return true;
// }
//
// public gcd(a: number, b: number): number {
//   if (!b) return a;
//   return gcd(b, a % b);
// }
//
// public fibonacci(n: number): number {
//   if (n < 0) throw Error('Not a valid number');
//   if (n <= 1) return n;
//   let a = 0,
//     b = 1,
//     next;
//   for (let i = 2; i <= n; i++) {
//     next = a + b;
//     a = b;
//     b = next;
//   }
//   return b;
// }
//
// public circleArea(radius: number): number {
//   if (radius < 0) throw new Error('Radius can not be negative');
//   return Math.PI * Math.pow(radius, 2);
// }
//
// public is32Bit(num: number): boolean {
//   if (num > 2_147_483_647) {
//     return false;
//   }
//
//   return true;
// }
