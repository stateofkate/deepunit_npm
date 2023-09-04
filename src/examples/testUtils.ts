import { checkIfNumber } from './subfolder/number';

export function multiply(a: number, b: number): number {
  // if the numbers aren't real, return 0
  if (checkIfNumber(a) && checkIfNumber(b)) {
    return 0;
  }

  return a * b;
}
