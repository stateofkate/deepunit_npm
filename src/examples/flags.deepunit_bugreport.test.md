I have analyzed the provided code and found a potential issue. The `getFilesFlag` function assumes that the flag `--f`, `--file`, or `--files` is always followed by a value. However, if any of these flags is the last argument, `args[index + 1]` will be `undefined` and calling `split` on it will throw an error.

To fix the bug, we should check that `args[index + 1]` is defined before calling `split`.

### Bug Report

#### Description

If the `--f`, `--file`, or `--files` flag is the last argument in the process.argv array, the `getFilesFlag` function throws an error. This happens because the function tries to call `split` on `args[index + 1]`, which is `undefined` if the flag is the last argument.

#### Reproduction Steps

1. Call the `getFilesFlag` function with `process.argv` containing `--f`, `--file`, or `--files` as the last argument.

#### Expected Behavior

The function should return an empty array or handle this case in a way that doesn't throw an error.

#### Actual Behavior

The function throws an error because it tries to call `split` on `undefined`.

#### Suggested Fix

Check that `args[index + 1]` is defined before calling `split` on it.

```typescript
args.forEach((arg, index) => {
  if ((arg === '--f' || arg === '--file' || arg === '--files') && index + 1 < args.length && args[index + 1] !== undefined) {
    files = files.concat(args[index + 1].split(','));
  }
});
```

#### Test Case

```typescript
test('getFilesFlag does not throw error when flag is last argument', () => {
  process.argv = ['node', 'script.js', '--f'];
  expect(() => getFilesFlag()).not.toThrow();
});
```