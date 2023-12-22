# Release Log

## 1.8.5
Features
- Fix an issue with the json flag

## 1.8.4
Changes
- Refactored some code
- dd improved prompting
- Allow arbitrary prompt injection

## 1.8.3
Features
- Added new flags to support absolute paths with --ab
- Added summary into the json output

## 1.8.2
Features
- Added new --email flag
- Added new --y yes flag to say yes to everything
- Added --ff flag to force filtering on files

## 1.7.1
Features
- Added a new bug finding feature which will generate a bug report for a given file using the -b flag to pass a file path

Features
## 1.7.0

Features
- Improved support for constructors and mocks

Bugs
- Fixed a bug which sometimes jumbled code
- Fixed a bug that sometimes cause a file to be listed twice in the summary

## 1.6.3
Features
- Added support for our new Visual Studio Code extension
- Improved test generation quality

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
