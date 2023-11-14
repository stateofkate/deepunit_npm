# Release Log

## 1.6.3
Features
- Added support for our new Visual Studio Code extension

Bugs
- Removed a confusing warning when the prettier file is not found
- Improved file filtering
- Improved error reporting

## 1.6.2
Features
- Clarified supported platforms in the documentation
- Clarified error messages when we do not support platforms
- Added better debugging capabilities

## 1.6.1
Features
- Added links to documentation

## 1.6.0
Features
- Added retryTestGenerationOnFailure option to retry when we fail to generate a passing test
- Added spinner when waiting for API calls to complete

Bugs
- Fixed a fatal issue with logging incorrectly

## 1.5.4
Features:
- Added a --feedback flag so that you can easily make bug reports or request features

## 1.5.3
Features:
- Improved React support
- Updated Readme
- Added --pattern flag
- Fixed a TypeScript bug
- Improved --file flag parsing and added more clear error handling when a file does not exist
## 1.5.2
Bugs:
- Fix an error with accessing undefined properties

## 1.5.1
Features:

- Improved error logging
- Allow setting the test suffix of the file with the "testSuffix" config

## 1.5.0
Features:

- Help command
- Improved file selection
- Improved test generation
-
Bugs:
- Fix a fatal issue parsing JSON

## 1.4.0

Features:

- Improved test layout (remove wrapping numerical describe blocks)

Bugs:

- Fix required `src` directory, now runs in all directories.
- Fix issue with class imports not working
