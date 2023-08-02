#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';
import {execSync} from "child_process";
import axios from "axios";
import * as readline from "readline";
import ts from "typescript";

console.log("Arrr matey, the world I be plundering!");
console.log("Arrr matey, the world I be plundering!");

/** Automatically Detected Project configs
 * These configs are first pulled from deepunit.config.json, if absent we will try to use the detect*() function to autodetect
 */
let configPath: string = '';
let workspaceDir: string = ""; //If your package.json is not in the root directory set this to the directory it is located in. The autodetect function will reset it to the root directory if package.json is not found in the directory specified
let frontendFramework: string = "";
let testingFramework: string = "";
let scriptTarget: string = "";
let typescriptExtension: string = "";
let testExtension: string = "";
let rootDir: string = process.cwd();

/**
 * Manually set configs
 */
let verboseTestOutput: boolean = false;
let verboseLogging: boolean = true;
let allFiles: boolean = true; // grab list of files from last commit or recursively search all directories in the project for .ts or html files
let ignoreDirectories: string[] = ['dumper'];  // Add paths to directories to never write tests for
let defaultIgnore: string[] = ['node_modules', '.angular', '.idea', 'dist', 'git_hooks'];  // Paths that most projects will never want to unit test
let ignoredFiles: string[] = ['index.html', 'index.tsx', 'polyfills.ts', 'test.ts', 'main.ts', 'environments/environment.ts', 'environments/environment.prod.ts'];  // ignore file paths ending in these names
let configFilePath: string = "deepunit.config.json";

// Api paths
let useProd: boolean = false;
let prodBase: string = "https://dumper.adaptable.app";
let generateApiPath: string = useProd ? `${prodBase}/generate-test/new` : "http://localhost:8080/generate-test/new";
let fixErrorApiPath: string = useProd ? `${prodBase}/generate-test/fix-error` : "http://localhost:8080/generate-test/fix-error";
let testApiPath: string = useProd ? `${prodBase}/generate-test/test-code` : "http://localhost:8080/generate-test/test-code";
let version: string = "0.2.0";

function detectWorkspaceDir() {
    process.chdir(rootDir);
    // Check if the configuration file exists
    let configWorkspaceDir = grabFromConfig('workspaceDir');
    const packageJson = "package.json"
    let packageJsonPath = packageJson;
    if (configWorkspaceDir) {
        packageJsonPath = path.join(configWorkspaceDir, 'package.json');
    }

    console.log(packageJsonPath)
    console.log(configWorkspaceDir)
    if (configWorkspaceDir && fs.existsSync(packageJsonPath)) {
        workspaceDir = configWorkspaceDir;
        debug("Detected workspaceDir: " + workspaceDir);
        // If package.json exists, leave workspaceDir as it is
    } else if (fs.existsSync(packageJson)) {
        //Looks like it wasn't in the config path, but is in the current working directory
        debug("Looks like it wasn't configured in deepunit.config.json, but is in the current working directory", verboseLogging)
        workspaceDir = "";
    } else {
        console.error("Unable to find package.json at " + packageJsonPath)
        console.error("Current working directory is " + process.cwd())
        console.error("Please resolve the path and update the workspaceDir in deepunit.config.json")
        workspaceDir = "";
        console.log("Need help? Email justin@deepunit.ai")
        process.exit(1) //We can't continue until the user fixes this error
    }
    debug("Detected repo located at workspaceDir: " + workspaceDir, verboseLogging);
}

function detectProjectType() {
    process.chdir(rootDir);
    const configValue = grabFromConfig('frontendFramework')
    if(configValue) {
        frontendFramework = configValue
        return;
    }
    let angularJsonPath = 'angular.json';
    let packageJsonPath = 'package.json';

    // If workspaceDir is not empty, join the path
    if (workspaceDir) {
        angularJsonPath = path.join(workspaceDir, 'angular.json');
        packageJsonPath = path.join(workspaceDir, 'package.json');
    }

    if (fs.existsSync(angularJsonPath)) {
        frontendFramework = 'angular';
        debug("Detected frontendFramework: " + frontendFramework, true);
        return;
    } else if (fs.existsSync(packageJsonPath)) {
        let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        let dependencies = packageJson['dependencies'] || {};
        let devDependencies = packageJson['devDependencies'] || {};
        if ('react' in dependencies || 'react' in devDependencies) {
            frontendFramework = 'react';
            debug("Detected frontendFramework: " + frontendFramework, true);
            return;
        }
        if ('angular/common' in dependencies || 'angular/common' in devDependencies) {
            frontendFramework = 'angular';
            debug("Detected frontendFramework: " + frontendFramework, true);
            return;
        }
    }
    frontendFramework = 'unknown';
    debug('WARNING: Unable to detect frontend framework, typescript extension', true);
}
function detectTestFramework() {
    let jestConfigPath = 'jest.config.js';
    let karmaConfigPath = 'karma.conf.js';
    let packageJsonPath = 'package.json';

    // If workspaceDir is not empty, join the path
    if (workspaceDir) {
        jestConfigPath = path.join(workspaceDir, 'jest.config.js');
        karmaConfigPath = path.join(workspaceDir, 'karma.conf.js');
        packageJsonPath = path.join(workspaceDir, 'package.json');
    }

    if (fs.existsSync(jestConfigPath)) {
        testingFramework = 'jest';
        testExtension = '.test.ts'
    } else if (fs.existsSync(karmaConfigPath)) {
        testingFramework = 'jasmine';
        testExtension = '.spec.ts'
    } else if (fs.existsSync(packageJsonPath)) {
        let fileContent = fs.readFileSync(packageJsonPath, 'utf8');
        if (fileContent.includes('jest')) {
            testingFramework = 'jest';
            testExtension = '.test.ts'
        } else if (fileContent.includes('jasmine-core')) {
            testingFramework = 'jasmine';
            testExtension = '.spec.ts'
        }
    }

    debug("Detected testingFramework: " + testingFramework, true);
}
function detectTsconfigTarget() {
    let tsconfigPath: string | null = path.join(workspaceDir, 'tsconfig.json');
    let typescriptExtension = '.ts';

    while (tsconfigPath) {
        if (fs.existsSync(tsconfigPath)) {
            let contents = fs.readFileSync(tsconfigPath, 'utf8');
            try {
                let tsconfigJson = ts.parseConfigFileTextToJson('', contents);
                scriptTarget = tsconfigJson.config?.compilerOptions?.target ? tsconfigJson.config?.compilerOptions?.target : undefined
                if (tsconfigJson.config?.compilerOptions?.jsx) {
                    typescriptExtension = '.tsx';
                }
                if (tsconfigPath != null) {
                    // @ts-ignore
                    tsconfigPath = tsconfigJson.config?.extends ? path.join(path.dirname(tsconfigPath), tsconfigJson.config?.extends) : null;
                }

            } catch (error) {
                console.log(error)
                console.error("Error parsing tsconfig.json. JSON does not support comments. Please remove the comment at the top of " + tsconfigPath + " and try again.");
                console.log("Need help? Email justin@deepunit.ai")
                process.exit(1);
            }
        } else {
            console.error("Error: unable to find tsconfig at " + tsconfigPath);
            console.error("The current working director is " + process.cwd());
            console.error("Please notify the appropriate team to add a tsconfig path config");
            console.log("Need help? Email justin@deepunit.ai")
            process.exit(1);
        }
    }

    console.log("Detected ES target: " + scriptTarget);
    return scriptTarget;
}

function detectTypescriptExtension() {
    const configTypescript = grabFromConfig('typescriptExtension')
    if(configTypescript) {
        typescriptExtension = configTypescript
    } else if (typescriptExtension) {
        console.log("found it in the tsconfig")
    } else if (frontendFramework === "react") {
        typescriptExtension = '.tsx'
    } else if(frontendFramework === 'angular') {
        typescriptExtension = '.ts'
    } else {
        typescriptExtension = '.ts'
    }
    console.log("Typescript extension is : " + typescriptExtension)
}
function grabFromConfig(configProperty: string): string | null {
    if (fs.existsSync(configFilePath)) {
        let config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

        // Check if the 'repoPath' property exists in the configuration
        if (configProperty in config) {
            let configValue = config[configProperty];
            return configValue;
        }
    }
    return null;
}
function debug(inputString: string, doProd = false) {
    let doDebug = false;
    if (doDebug) {
        console.debug(inputString);
    }
    if (doProd) {
        console.log(inputString);
    }
}

function getChangedFiles(): string[] {
    const changedFilesCmd = 'git diff --name-only HEAD~1 HEAD';
    const output = execSync(changedFilesCmd).toString();
    return output.split('\n').filter(Boolean);
}

function getDiff(files: string[]): string {
    const diffCmd = `git diff --unified=0 HEAD~1 HEAD -- ${files.join(' ')}`;
    return execSync(diffCmd).toString();
}

function getFileContent(file: string | null): string | null {
    if (file === null) {
        return null;
    }
    try {
        const content = fs.readFileSync(file, 'utf-8');
        return content;
    } catch (error) {
        if (error instanceof Error) {
            // @ts-ignore
            if (error.code === 'ENOENT') {
                console.warn(`Warning: File ${file} not found`);
            } else {
                console.error(error)
                console.error(`An error occurred while trying to read ${file}: ${error}`);
            }
        }
        return null;
    }
}
function getTestVersion(file: string): string {
    let testVersion: string = '';
    try {
        testVersion = fs.readFileSync(file, 'utf-8');
    } catch (error) {
        if (error instanceof Error) {
            console.error('Had an error in reading the file, woopsies');
            console.error(file);
            console.error(error)
            console.log("Need help? Email justin@deepunit.ai")
            process.exit(1)
        }
    }
    return testVersion;
}

function getDirectory(file: string): string {
    return path.dirname(file);
}

function getTestName(file: string): string {
    console.log(testExtension)
    const testFileName = file.split('.').slice(0, -1).join('.') + testExtension;
    return testFileName;
}
type generateTestData = {
    diffs: string;
    frontendFramework: string;
    testingFramework: string;
    scriptTarget: string;
    version: string;
    tsFile?: {[key: string]: string};
    htmlFile?: {[key: string]: string};
    testFile?: {[key: string]: string};
};
async function generateTest(
    diffs: string,
    tsFile: string | null,
    tsFileContent: string | null,
    htmlFile: string | null,
    htmlFileContent: string | null,
    testFile: string,
    testVersion: string
): Promise<undefined | any> {
    console.log('started')
    console.log(testFile)
    console.log(testVersion)
    console.log('done')
    const headers = {'Content-Type': 'application/json'};
    let data: generateTestData = {
        diffs,
        frontendFramework: frontendFramework,
        testingFramework: testingFramework,
        scriptTarget: scriptTarget,
        version
    };
    if (tsFile && tsFileContent) {
        data.tsFile = {[tsFile]: tsFileContent};
    }
    if (htmlFile && htmlFileContent) {
        data.htmlFile = {[htmlFile]: htmlFileContent};
    }
    if (testFile || testVersion) {
        data.testFile = {[testFile]: testVersion};
    }
console.log(data)
    console.log(`Generating test for tsFile: ${tsFile}, htmlFile: ${htmlFile}`);

    const maxRetries = 2;
    const baseDelay = 0; // delay in ms

    for (let i = 0; i <= maxRetries; i++) {
        try {
            const response = await axios.post(generateApiPath, data, {headers});
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                const statusCode = error.response.status;
                    const delay = baseDelay * Math.pow(2, i); // exponential backoff
                    console.warn(`Received a ${statusCode} error, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`Failed with error: ${error}`);
                return undefined;
            }
        }
    }

    console.error("Failed after maximum retries");
    return undefined;
}
function prettyPrintJson(jsonObj: Record<string, any>, doProd= true) {
    debug(JSON.stringify(jsonObj, null, 2), doProd);
}
const errorPattern = /Error: (.*?):(.*?)\n/;

async function fixErrors(
    file: string,
    testVersion: string,
    diff: string,
    tsFile: string | null,
    tsFileContent: string | null
): Promise<[boolean, string, boolean, (string | null)]> {
    let errors = '';
    let attempts = 0;

    if (!errorPattern) {
        throw new Error(`Unsupported testing framework: ${testingFramework}`);
    }
    let matches = await runTestErrorOutput(file);
    while (attempts < 1 && matches.length>0) {
        console.log(' ', '##########################################################\n', '################### Begin fixing error ###################\n', '##########################################################');
        if(attempts>0) {
            matches = await runTestErrorOutput(file);
        }

        if (!matches) {
            console.log(matches)
            console.log(`Fixed all errors for ${file}`);
            return [true, errors, false, null];
        }

        console.log(matches.length)
        const match = matches.pop();
        console.log(matches.length)
        if(match === undefined) {
            console.log(match)
            console.log('that was the match')
            console.log(matches)
            console.log("match was undefined, I don't think this could ever happen, but if it did it could cause an infinite loop")
            continue;
        } else if(match.includes('Your test suite must contain at least one test.')) {
            //never fix the empty test error
            if(matches.length<=1) {
                break;
            }
            continue;
        }
        const errorString = testingFramework === 'jasmine' ? `${match[0]}${match[1]}` : match;
        console.log(`Fixing error: ${errorString}`);

        const headers = { 'Content-Type': 'application/json' };
        const data = {
            error_message: errorString,
            test_code: testVersion,
            diff,
            ts_file_name: tsFile,
            ts_file_content: tsFileContent,
            script_target: scriptTarget,
            frontend_framework: frontendFramework,
            testingFramework: testingFramework,
            version
        };

        let fixedTestCode: string;

        try {
            const response = await axios.post(fixErrorApiPath, data, { headers });
            console.log(response)
            fixedTestCode = response.data.fixed_test;
        } catch (error) {
            return [false, errors, true, null];
        }
        console.log(fixedTestCode)
        fs.writeFileSync(file, fixedTestCode);

        attempts++;

        if (attempts === 7 && matches) {
            console.log(`Unable to fix all errors, resetting any uncommitted changes in ${file}...`);
            execSync(`git checkout -- ${file}`);
            return [false, errors, false, fixedTestCode];
        }
    }

    return [true, errors, false, null];
}

function runJestTest(file: string) {
    let relativeTestFilePath = file;
    process.chdir(rootDir);

    if (workspaceDir) {
        process.chdir(workspaceDir);
        relativeTestFilePath = path.relative(workspaceDir, file);
    }
    let result;
    try {
        result = execSync(`npx jest --json ${file} --passWithNoTests`, { stdio: ['pipe', 'pipe', 'pipe'] });
        process.chdir(rootDir);
    } catch (error: any) {
        process.chdir(rootDir);
        result = error
        if (error.stdout) {
            result = JSON.parse(error.stdout.toString())
            /*console.log(result)*/
        } else {
            // If there's no stdout, rethrow the error
            throw error;
        }
    }
    return result;
}
function runTestErrorOutput(file: string): string[] {
    let relativeTestFilePath = file;
    process.chdir(rootDir);

    let result: Buffer;
    let stdout;
    let stderr;

    if (frontendFramework === 'angular') {
        const errorPattern = /Error: (.*?):(.*?)\n/;
        if (workspaceDir) {
            process.chdir(workspaceDir);
            relativeTestFilePath = path.relative(workspaceDir, file);
        }
        result = execSync(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${relativeTestFilePath}`, { stdio: 'pipe' });
        stdout = result.toString();
        process.chdir(rootDir);
        return stdout.match(errorPattern) || [];
    } else if (testingFramework === 'jest') {
        const result = runJestTest(file)
        console.log(result)
        if(result.numFailedTestSuites === 0) {
            console.log('is 0')
            return [];
        } else {
            console.log('mapping didnt work')
            return result.testResults.map((testResult: any) => testResult.message);
        }
    } else {
        throw new Error(`Unsupported frontend framework: ${frontendFramework}`);
    }

    const errorMessages: string[] = [];
    if (stderr) {
        errorMessages.push(stderr);
    }

    try {
        const outputJson = JSON.parse(stdout);
        for (const suite of outputJson.testResults) {
            for (const assertion of suite.assertionResults) {
                if (assertion.status === 'failed') {
                    errorMessages.push(...assertion.failureMessages);
                }
            }
        }
    } catch {
        errorMessages.push(`Failed to parse test output: ${stdout}`);
    }

    return errorMessages;
}

function runTest(file: string): string {
    let relativeTestFilePath = file;
    process.chdir(rootDir);

    let result;
    let stdout;

    if (frontendFramework === 'angular') {
        const command = [];
        if (fs.existsSync(file)) {
            if (workspaceDir) {
                process.chdir(workspaceDir);
                relativeTestFilePath = path.relative(workspaceDir, file);
            }
            result = execSync(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${relativeTestFilePath}`, { stdio: 'pipe' });
        } else {
            if (workspaceDir) {
                process.chdir(workspaceDir);
            }
            result = execSync('ng test --browsers=ChromeHeadless --no-watch --no-progress', { stdio: 'pipe' });
        }
        stdout = result.toString();
        process.chdir(rootDir);
    } else if (frontendFramework === 'react') {
        if (workspaceDir) {
            process.chdir(workspaceDir);
            relativeTestFilePath = path.relative(workspaceDir, file);
        }
        result = execSync(`npx jest ${relativeTestFilePath}`, { stdio: 'pipe' });
        stdout = result.toString();
        process.chdir(rootDir);
    } else {
        throw new Error(`Unsupported frontend framework: ${frontendFramework}`);
    }

    return stdout;
}
function getInput(): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question('Do you want to continue fixing errors? (y/n): ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'n') {
                resolve(false);
            } else if (answer.toLowerCase() === 'y') {
                console.log('Y received, continuing execution');
                resolve(true);
            } else {
                console.log('Invalid input. Please enter y or n.');
                resolve(getInput());
            }
        });
    });
}
function groupFilesByDirectory(changedFiles: string[]): Record<string, string[]> {
    const filesByDirectory: Record<string, string[]> = {};

    for (const file of changedFiles) {
        const directory = path.dirname(file);

        if (!filesByDirectory[directory]) {
            filesByDirectory[directory] = [];
        }

        filesByDirectory[directory].push(file);
    }

    return filesByDirectory;
}
function tsAndHtmlFromFile(file: string, filesInDirectory: string[]): [string | null, string | null, string | null] {
    const baseFile = path.basename(file, path.extname(file));
    const extension = path.extname(file);
    let correspondingFile: string | null = null;

    if (extension === typescriptExtension) {
        correspondingFile = `${baseFile}.html`;
    } else if (extension === '.html') {
        correspondingFile = `${baseFile}${typescriptExtension}`;
    }

    let htmlFile: string | null = null;
    let tsFile: string | null = null;

    if (correspondingFile && filesInDirectory.includes(correspondingFile)) {
        if (extension === typescriptExtension) {
            tsFile = file;
            htmlFile = correspondingFile;
        } else {
            tsFile = correspondingFile;
            htmlFile = file;
        }
    } else {
        if (extension === typescriptExtension) {
            tsFile = file;
        } else {
            htmlFile = file;
        }
    }

    return [tsFile, htmlFile, correspondingFile];
}
async function testCode(): Promise<void> {
    const headers = { 'Content-Type': 'application/json' };

    try {
        const response = await axios.post(testApiPath, {}, { headers });
        console.log(response);
    } catch (error) {
        console.log(error);
    }
    console.log("Need help? Email justin@deepunit.ai")
    process.exit();
}
function checkIfJestTestPasses(testFile: string): boolean {
    console.log(`Checking if ${testFile} passes before attempting to modify it`);
    const result = runJestTest(testFile)
    if(result.numFailedTestSuites === 0 || result.numFailedTestSuites === 1 && result.testResults[0].message.includes("Your test suite must contain at least one test.")) {
        return true;
    }
    return 0  === result.numFailedTestSuites
}
function checkIfAngularTestsPass(testFile: string): boolean {
    console.log(`Checking if all Angular tests pass`);

    let output;
    try {
        output = execSync(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${testFile}`).toString();
    } catch (error) {
        console.log(error)
        console.log(`Error running tests: ${error}`);
        return false;
    }

    console.log(`Output for Angular tests`);
    console.log(output);

    if (parseFailedAngularTestOutput(output)) {
        console.log(output);
        console.log(`DeepUnit was unable to run because the above tests are failing. Please fix them if your last commit broke them or deleted their content and let us regenerate new ones`);
        console.log("Need help? Email justin@deepunit.ai")
        process.exit();
    }

    return true;
}
function printSummary(
    failingTests: string[],
    testsWithErrors: string[],
    passingTests: string[],
    apiErrors: string[],
    testRunResults: string[]
): void {

    if (testRunResults) {
        console.log("Here are the final results from running the tests:");
        for (const result of testRunResults) {
            console.log(result);
        }
    }

    console.log("#####################################");
    console.log("##### Summary of DeepUnitAI Run #####");
    console.log("#####################################");

    if (failingTests.length > 0) {
        console.log("\nThe following tests were failing after your last commit. You will need to fix them before we can write new tests for you.:");
        for (const test of failingTests) {
            console.log(`     ${test}`);
        }
    }

    if (testsWithErrors.length > 0) {
        console.log("\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:");
        for (const test of testsWithErrors) {
            console.log(`     ${test}`);
        }
    }

    if (passingTests.length > 0) {
        console.log("\nWe successfully generated tests for the following files, and they pass without errors:");
        for (const test of passingTests) {
            console.log(`     ${test}`);
        }
    }

    if (apiErrors.length > 0) {
        console.log("\nWe had API errors while generating the following tests, see the logs above.\nTry again and if you're seeing this frequently bother Justin@deepunit.ai to find a fix this:");
        for (const test of apiErrors) {
            console.log(`     ${test}`);
        }
    }

    console.log('\n');
}
function doesFileExist(filename: string): boolean {
    return fs.existsSync(filename);
}
function createFile(filename: string): void {
    // Create a new file
    fs.writeFileSync(filename, '');

    // Run git add on the file
    try {
        execSync(`git add ${filename}`);
    } catch (error) {
        console.error(filename)
        console.error(error)
        console.error(`Error running git add: `);
    }
}
function findFiles(extensions: string[], ignoreExtensions: string[]): string[] {
    /**
    Find all files in all nested directories within workspaceDir with the given extensions and ignore files with the given ignoreExtensions.

        Parameters:
    extensions (list): List of extensions to match.
    ignoreExtensions (list): List of extensions to ignore.

        Returns:
    list: List of full paths to files that match the given extensions and do not match the ignoreExtensions.
    */
    const matches: string[] = [];
    const walkDir = workspaceDir || 'src'; // replace with actual workspaceDir if needed

    function walk(directory: string) {
        const files = fs.readdirSync(directory);

        for (const file of files) {
            const fullPath = path.join(directory, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (extensions.some(ext => file.endsWith(ext)) &&
                !ignoreExtensions.some(ext => file.endsWith(ext))) {
                matches.push(fullPath);
            }
        }
    }

    walk(walkDir);
    return matches;
}

/**
 * Filter out files that are within certain directories or match certain filenames.
 *
 *   Parameters:
 *   files (list): List of file paths.
 *
 *   Returns:
 *   list: List of file paths that are not within the ignoreDirectories, defaultIgnore directories, and do not match filenames in ignoredFiles.
 */
function filterFiles(files: string[]): string[] {
    const filteredFiles: string[] = [];
    const ignoreDirectories = ['dir1', 'dir2']; // replace with your ignore directories
    const defaultIgnore = ['defaultIgnore1', 'defaultIgnore2']; // replace with your default ignore directories
    const ignoredFiles = ['ignoreFile1', 'ignoreFile2']; // replace with your ignore files
    const workspaceDir = 'workspaceDir'; // replace with your workspace directory

    const combinedIgnoreDirs = ignoreDirectories.concat(defaultIgnore).map(dir => path.join(workspaceDir, dir));

    for (const file of files) {
        if (!combinedIgnoreDirs.some(ignoreDir => file.includes(ignoreDir)) &&
            !ignoredFiles.some(ignoreFile => file.endsWith(ignoreFile))) {
            filteredFiles.push(file);
        }
    }

    return filteredFiles;
}

/**
 * Save tests from testContentWithErrors to the filesystem.
 */
type TestInfo = { [key: string]: string };
function saveTestsWithErrors(testContentWithErrors: TestInfo[]): void {
    for (const testInfo of testContentWithErrors) {
        for (const [test, content] of Object.entries(testInfo)) {
            fs.writeFileSync(test, content);
        }
    }
}

/**
 * Parse the test output to find if tests all pass.
 *
 *   Parameters:
 *   output (str): The test output.
 */
function parseFailedAngularTestOutput(output: string): boolean {
    const match = output.match(/TOTAL: (\d+) FAILED, (\d+) SUCCESS/);

    if (match) {
        const failedTests = parseInt(match[1]);
        const successfulTests = parseInt(match[2]);
        console.log(`Matched, found ${failedTests} and also found: ${successfulTests}`);
        return failedTests < 1; // if any tests failed return false
    } else {
        const executedMatch = output.match(/Executed (\d+) of/);
        if (executedMatch) {
            return true; // this should occur because we had no tests in the specified file, but there were no other errors in the other files
        } else {
            return false; // There was an error in this case
        }
    }
}
function writeTestsToFiles(tests: Record<string, string>, skip: boolean) {
    if (skip) {
        return;
    }
    console.log(tests)
    console.log('its saving')
    for (const [testFilePath, testCode] of Object.entries(tests)) {
        save(testFilePath, testCode);
    }
}

function save(testFilePath: string, testCode: string) {
    console.log(process.cwd());
    console.log(testFilePath);
    console.log(`Stashing any uncommitted changes in ${testFilePath}...`);
    execSync(`git stash push ${testFilePath}`);
    fs.writeFileSync(testFilePath, testCode);
}
async function main() {
    let skip = false;
    if (skip) {
        return;
    }
    await detectWorkspaceDir();
    await detectProjectType();
    await detectTestFramework();
    await detectTsconfigTarget();
    await detectTypescriptExtension()
    debug("#################################################", true);
    debug("##### Generating unit tests with DeepUnitAI #####", true);
    debug("#################################################", true);

    let changedFiles: string[];
    if (allFiles) {
        changedFiles = findFiles([typescriptExtension, ".html"], [".spec.ts", ".test.tsx", ".test.ts", ".consts.ts", '.module.ts']);
    } else {
        changedFiles = getChangedFiles();
    }
    console.log(changedFiles)
    const filteredChangedFiles = filterFiles(changedFiles);
    console.log(filteredChangedFiles)
    const filesByDirectory = groupFilesByDirectory(filteredChangedFiles);

    let failingTests: string[] = [];
    let testsWithErrors: string[] = [];
    let testContentWithErrors: any[] = [];
    let passingTests: string[] = [];
    let testRunResults: string[] = [];
    let apiErrors: string[] = [];
    let firstRun = true;

    for (const directory in filesByDirectory) {
        let filesInDirectory = filesByDirectory[directory];
        while (filesInDirectory.length > 0) {
            const file = filesInDirectory.pop();
            if(file === undefined) {
                continue;
            }
            console.log("##### file: " +file)
            const testFile = getTestName(file);
            console.log("##### testname: " +testFile)

            if (firstRun && frontendFramework === "angular") {
                checkIfAngularTestsPass(testFile);
                firstRun = false;
            }

            if (!fs.existsSync(testFile)) {
                fs.writeFileSync(testFile, '');
            } else if (frontendFramework !== "angular") {
                const doesTestPass = checkIfJestTestPasses(testFile);
                if (!doesTestPass) {
                    failingTests.push(testFile);
                    continue;
                }
            }

            const testVersion = getTestVersion(testFile);
            const [tsFile, htmlFile, correspondingFile] = tsAndHtmlFromFile(file, filesInDirectory);

            if (correspondingFile && filesInDirectory.includes(correspondingFile)) {
                const index = filesInDirectory.indexOf(correspondingFile);
                if (index > -1) {
                    filesInDirectory.splice(index, 1);
                }
            }
            let filesToPass = [];
            if(tsFile) {
                filesToPass.push(tsFile)
            }
            if(htmlFile) {
                filesToPass.push(htmlFile)
            }
            const diff = getDiff(filesToPass);
            let tsFileContent = getFileContent(tsFile);
            const htmlFileContent = getFileContent(htmlFile);
            // @ts-ignore
            tsFileContent = tsFileContent?.split('fs.writeFileSync(testFilePath, testCode);\n' +
                '}')[1]
            console.log(tsFileContent)
            console.log('tsFile: '+ tsFile)


            const response = await generateTest(diff, tsFile, tsFileContent, htmlFile, htmlFileContent, testFile, testVersion);
            console.log(response)
            let tests;
            if (!response) {
                apiErrors.push(testFile);
                continue;
            }
            try {
                const tests = response.tests;
                // todo: fix the issue with which files  so we can
                writeTestsToFiles(tests, false);
            } catch (error) {
                console.error("Caught error trying to writeTestsToFiles")
                console.error(error)
                console.error(response)
                apiErrors.push(testFile);
            }

            const [fixedAllErrors, runResults, apiError, fixedTest] = await fixErrors(testFile, testVersion, diff, tsFile, tsFileContent);
            if (apiError) {
                console.log("API error encountered");
                apiErrors.push(testFile);
                continue;
            }

            testRunResults.push(`\n     Result for: ${testFile}`);
            testRunResults.push(runResults);
            if (fixedAllErrors) {
                passingTests.push(testFile);
            } else {
                testsWithErrors.push(testFile);
                if (frontendFramework === "angular") {
                    testContentWithErrors.push({ test: testFile, testContent: fixedTest });
                }
            }
        }
    }
    console.log("Completed the first loop");

    saveTestsWithErrors(testContentWithErrors);
    printSummary(failingTests, testsWithErrors, passingTests, apiErrors, testRunResults);

    console.log("Need help? Email justin@deepunit.ai")
    process.exit(100);

    console.log("Remove the exit");
}

if (require.main === module) {
    main();
}
