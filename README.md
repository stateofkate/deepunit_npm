# DeepUnit.AI

AI-Powered Unit Test Generation: Ensured Reliability through Post-Creation Testing.

## Release State

Currently in **Alpha** release.
The application generates working tests fairly consistently, but does require a lot of supervision from user currently.

## Authentication

For a seamless experience with DeepUnit.Ai, we ask users to provide a valid email upon the initial application setup. This email serves as your identifier across all your git repositories and is saved in the `~/.deepunit` file. If ever you wish to update your email, simply delete the `.deepunit` file in your home directory and restart the application.

## Config

Here is an example of the `deepunit.config.json` with comments explaining each purpose.

```javascript
{
  // force what the frontendframework is (react, node)
  "frontendFramework": "react"

  // which directories you want to ignore, path is from the current working directory
  "ignoredDirectories": [],

  // which files you want to ignore, path is from the current working directory
  "ignoredFiles": ["src/main.consts.ts", "src/utils.ts", "src/Config.ts"],

  // when all tests for a file fail, this option allows DeepUnit.AI to save the failing tests to a file so that you fix them manually
  "includeFailingTests": false,

  // what gets added between the name of file and the extension. Example if set to 'spec': Utils.ts -> Utils.spec.ts (default set to test)
  "testSuffix": "test",

  // What language you want the tests to generate in (forcing it to be a specific language)
  // Options are "javascript" or "typescript" right now
  "testingLanguageOverride": "javascript"
}
```

## Choosing what to test

To choose what to test, you have a few options

- Use the `--file` flag to choose what files you would like to test (the files should be separated by a "`,`")
- Use the `--all` flag to do generate tests for all eligible files in the workspace.
- Without any file flag, it will automatically try to find all files that it can write tests for in your workspace.
- Use the `ignoredDirectories` or `ignoredFiles` to ignore files, other than ones you want to test
- If you have a function, method, or entire class you would like DeepUnit.AI not to test, add `// @deep-unit-ignore-next-line` in front of the function or class, like so:

```typescript
// @deep-unit-ignore-next-line
function example(): void {
  // ... other code
}
```

```typescript
// @deep-unit-ignore-next-line
class NoneTestableClass() {
  example(): void {
    // ... other code
  }
}
```

_Note:
DeepUnit.Ai intelligently skips functions that already have tests in the corresponding test files. If you encounter issues generating a test for a specific function, ensure that it hasn't been tested elsewhere in the file._

## Contact

If you have any questions, please contact `support@deepunit.ai` for more details.
