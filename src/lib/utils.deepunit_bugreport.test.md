## Bug Report

### Description
The `checkFeedbackFlag` function does not correctly check if the `--feedback` flag is present in the command line arguments.

### Code
```typescript
export function checkFeedbackFlag(): boolean {
  let result: boolean = false;
  //check what argv contains
  const arg: string = process.argv[2];
  // will change this so that
  // conditions for feedback: strlen(arg) > 10;

  return arg === '--feedback';
}
```

### Bug
The `checkFeedbackFlag` function compares the command line argument `arg` with the string `--feedback` to determine if the `--feedback` flag is present. However, this comparison will only return `true` if the `arg` is exactly equal to `--feedback`. This means that if there are any additional characters or spaces before or after `--feedback`, the function will return `false`, even if the flag is present.

### Test Case
```typescript
import { checkFeedbackFlag } from './utils';

describe('checkFeedbackFlag', () => {
  it('should return true if --feedback flag is present', () => {
    process.argv[2] = '--feedback';
    expect(checkFeedbackFlag()).toBe(true);
  });

  it('should return true if --feedback flag is present with additional characters', () => {
    process.argv[2] = '   --feedback   ';
    expect(checkFeedbackFlag()).toBe(true);
  });

  it('should return false if --feedback flag is not present', () => {
    process.argv[2] = '--no-feedback';
    expect(checkFeedbackFlag()).toBe(false);
  });
});
```

### Note
This bug report assumes that the `CONFIG` object is correctly imported and used in the code. If the `CONFIG` object is not used correctly, it may cause additional bugs.