import fs from 'fs';

export function checkIfFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
