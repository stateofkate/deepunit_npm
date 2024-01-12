import { checkIfNumber } from './subfolder/number';

export function multiply(a: number, b: number): number {
  // if the numbers are not real, return 0
  if (!checkIfNumber(a) && !checkIfNumber(b)) {
    return 0;
  }

  return a * b;
}
