From the provided TypeScript code, it seems like the function `getFilesFlag` is designed to take command line arguments and extract the file paths provided after the flags `--f`, `--file`, or `--files`. However, there seems to be a bug in the way it handles the arguments.

## Bug Report

### Bug Description
The bug lies in the processing of command line arguments. If an argument matches `--f`, `--file`, or `--files` and is not the last argument in the `args` array, the function assumes the next argument is a file path(s) and adds it to the `files` array. This could lead to wrong results if the next argument is another flag instead of a file path.

### Test Case
Consider the following command line arguments:

    --file --verbose test1.txt,test2.txt

Here, `--verbose` is a flag but it would be treated as a file path by the function. The `files` array would incorrectly include `--verbose` as a file path.

You can use the following test case to validate this bug:

```typescript
test('getFilesFlag should not include flags as file paths', () => {
  // Mock process.argv
  process.argv = ['node', 'script', '--file', '--verbose', 'test1.txt,test2.txt'];
  
  // Call getFilesFlag function
  const files = getFilesFlag();
  
  // Verify that --verbose is not included as a file path
  expect(files).not.toContain('--verbose');
  
  // Verify that test1.txt and test2.txt are included as file paths
  expect(files).toContain('test1.txt');
  expect(files).toContain('test2.txt');
});
```

This test case mocks the `process.argv` to simulate the command line arguments and then checks the output of the `getFilesFlag` function. The test will fail with the current implementation of the function, demonstrating the bug.