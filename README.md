# DeepUnit.AI

Generating Tested Unit Tests with Artificial Intelligence.

## Release State

Currently in **Alpha** release.
Password is passed around on per request basis. The application generates working tests fairly consistently, but does require a lot of supervision from user currently.

## Config

Here is an example of the `deepunit.config.json` with comments explaining each purpose.

```json
{
  // what typescript extension you are using (only allowed one extension right now)
  "typescriptExtension": ".ts",
  

  // Get password from support@deepunit.ai, this is for approved alpha users only
  "password": "securepassword",

  // which directories you want to ignore, path is from the current working directory
  "ignoredDirectories": [],

  // which files you want to ignore, path is from the current working directory
  "ignoredFiles": ["src/main.consts.ts", "src/utils.ts", "src/Config.ts"],

  // when all tests for a file fail, this option allows DeepUnit.AI to save the failing tests to a file so that you fix them manually
  "includeFailingTests": false,

  // test only the files that are changed from the HEAD branch
  "generateChangedFilesOnly": false
}
```

## Choosing what to test

To choose what to test, you have a few options

1. Use the `ignoredDirectories` or `ignoredFiles` to ignore files, other than ones you want to test
2. DeepUnit will automatically not test any functions that are already tested in the corresponding test files, if you are having a hard time getting it to generate a function, confirm it is not already used anywhere in the test file.
3. If you have a function or method you would like DeepUnit.AI not to test, add `// @deep-unit-ignore-next-line` in front of the function, like so:

```typescript
// @deep-unit-ignore-next-line
function example(): void {
  // ... other code
}
```

## Contact

If you have any questions, please contact `support@deepunit.ai` for more details.
