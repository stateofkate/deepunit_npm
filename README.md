# DeepUnit.AI

AI-Powered Unit Test Generation, provided by https://deepunit.ai. DeepUnitAi will generate your tests for you, guaranteeing valid code everytime.

## Table of Contents

- [Release State](#release-state)
- [Installation](#installation)
- [Usage](#usage)
- [Authentication](#authentication)
- [Config](#config)
- [Flags](#flags)
- [Ignoring Files](#ignoring-files)
- [Contact](#contact)

## Release State

Currently in **Alpha** release.

Currently only supported on `Linux`, `MacOS`, and `Windows through `[WSL](https://learn.microsoft.com/en-us/windows/wsl/install) _(native Windows is unsupported currently)_

The application generates working tests fairly consistently, but does require a lot of supervision from user currently.

Users are expected to always review tests that are generated for correctness before committing them.

## Usage

You can use DeepUnit without installing it by running the command
`npx deepunit --f path/to/file.ts`

## Authentication

For a seamless experience with DeepUnit.Ai, we ask users to provide a valid email upon the initial application setup. This email serves as your identifier across all your git repositories and is saved in the `~/.deepunit` file. If ever you wish to update your email, simply delete the `.deepunit` file in your home directory and restart the application.

## Config

DeepUnits config is stored in a file called `deepunit.config.json` which is automatically created for you. We support the following configs.

```javascript
{
  // Force what the frontendframework is (react, node, angular, etc) in case we detect it wrong
  "frontendFramework": "react"

  // We default to Jasmine if we are unable to detect your testing framework. This config forces sets the testing framework. This config is helpful if we are unable to detect that you are using jest or you use a Jest compatible framework like Vitest. 
  "testingFramework": "jest"

  // Which directories you want to ignore, path is from the root of the project. In case of a monorepo it is the root of the package.json deepunit is installed in.
  "ignoredDirectories": [],

  // Which files you want to ignore
  "ignoredFiles": ["src/main.consts.ts", "src/utils.ts", "src/Config.ts"],

  // when all tests for a file fail, this option allows DeepUnit.AI to save the failing tests to a file so that you fix them manually
  "includeFailingTests": false,

  // what gets added between the name of file and the extension. Example if set to 'spec': Utils.ts -> Utils.spec.ts (default set to test)
  "testSuffix": "test",

  // What language you want the tests to generate in (forcing it to be a specific language)
  // Options are "javascript" or "typescript" right now
  "testingLanguageOverride": "javascript",

  // we use git to get diffs from the default branch. The default is master unless configured here.
  "defaultBranch": "main"

  // Specify the type/goal of testcases you want to cover. Examples are happy path, edgecase, 80% code coverage, detect bugs, etc.
  "testCaseGoal": "edge cases"
  
  // Choose to use either OpenAIs models or open source models such as Mixtral or LLaMa
  "useOpenAi": false
}
```

## Provide additional testing/debugging instructions to AI model
To provide more specific instructions to the AI model (problems, testing paths, edge cases to look for), simply provide a comment at the top or your source code file beginning with 'deepunit-prompt-start' and ending with 'deepunit-prompt-end'

## Flags for identifying bugs
You can identify bugs with the --b flag. The --b flag will take in a file path and identify if there are potential bugs in it and return to you a bug report including a unit tests that identifies the bug
`npx deepunit --b path/to/file.ts`


## Flags for writing unit tests

To choose what to test, you have a few options

- Use the `--file` flag to choose what files you would like to test (the files should be separated by a "`,`")

`npx deepunit --f path/to/file.ts,path/to/second.ts`

- Use the `--pattern` flag to choose what patterns you would like to filter files for. We use `glob` under the hood (Example: `src/**` or `{lib,src}/*{.ts,.js}`), for more information about pattern matching visit: [VSCode Glob Matching](https://code.visualstudio.com/docs/editor/glob-patterns)

`npx deepunit --p {lib,src}/*{.ts,.js}`

- Use the `--all` flag to do generate tests for all eligible files in the workspace.

`npx deepunit --a`

- Without any flag, it will look at the last diff and attempt to write tests for the files in the diff.

`npx deepunit`

## Ignoring files

There will be certain directories, files or functions in your project which you won't want to test. You can configure DeepUnit to ignore these files or entire directories using the following configs in deepunit.config.json

- `ignoredDirectories` will ignore an entire directory
- `ignoredFiles` will ignore specific files
- `// @deep-unit-ignore-next-line` will ignore a function, method, or entire class. Add this inside your code just like you would `@ts-ignore`

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
