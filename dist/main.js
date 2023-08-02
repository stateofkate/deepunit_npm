#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const axios_1 = __importDefault(require("axios"));
const readline = __importStar(require("readline"));
console.log("Arrr matey, the world I be plundering!");
console.log("Arrr matey, the world I be plundering!");
/** Automatically Detected Project configs
 * These configs are first pulled from deepunit.config.json, if absent we will try to use the detect*() function to autodetect
 */
let configPath = '';
let workspaceDir = ""; //If your package.json is not in the root directory set this to the directory it is located in. The autodetect function will reset it to the root directory if package.json is not found in the directory specified
let frontendFramework = "";
let testingFramework = "";
let scriptTarget = "";
let typescriptExtension = "";
let testExtension = "";
let rootDir = process.cwd();
/**
 * Manually set configs
 */
let verboseTestOutput = false;
let verboseLogging = false;
let allFiles = false; // grab list of files from last commit or recursively search all directories in the project for .ts or html files
let ignoreDirectories = ['dumper']; // Add paths to directories to never write tests for
let defaultIgnore = ['node_modules', '.angular', '.idea', 'dist', 'git_hooks']; // Paths that most projects will never want to unit test
let ignoredFiles = ['index.html', 'index.tsx', 'polyfills.ts', 'test.ts', 'main.ts', 'environments/environment.ts', 'environments/environment.prod.ts']; // ignore file paths ending in these names
let configFilePath = "deepunit.config.json";
// Api paths
let useProd = true;
let prodBase = "https://dumper.adaptable.app";
let generateApiPath = useProd ? `${prodBase}/generate-test/new` : "http://localhost:8080/generate-test/new";
let fixErrorApiPath = useProd ? `${prodBase}/generate-test/fix-error` : "http://localhost:8080/generate-test/fix-error";
let testApiPath = useProd ? `${prodBase}/generate-test/test-code` : "http://localhost:8080/generate-test/test-code";
let version = "0.2.0";
function detectWorkspaceDir() {
    process.chdir(rootDir);
    // Check if the configuration file exists
    let configWorkspaceDir = grabFromConfig('workspaceDir');
    const packageJson = "package.json";
    let packageJsonPath = packageJson;
    if (configWorkspaceDir) {
        packageJsonPath = path.join(configWorkspaceDir, 'package.json');
    }
    if (configWorkspaceDir && fs.existsSync(packageJsonPath)) {
        workspaceDir = configWorkspaceDir;
        debug("Detected workspaceDir: " + workspaceDir);
        // If package.json exists, leave workspaceDir as it is
    }
    else if (fs.existsSync(packageJson)) {
        //Looks like it wasn't in the config path, but is in the current working directory
        debug("Looks like it wasn't in the config path, but is in the current working directory", verboseLogging);
        workspaceDir = "";
    }
    else {
        console.error("Unable to find package.json at " + packageJsonPath);
        console.error("Current working directory is " + process.cwd());
        console.error("Please resolve the path and update the workspaceDir in deepunit.config.json");
        workspaceDir = "";
        console.log("Need help? Email justin@deepunit.ai");
        process.exit(1); //We can't continue until the user fixes this error
    }
    debug("Detected repo located at workspaceDir: " + workspaceDir, verboseLogging);
}
function detectProjectType() {
    process.chdir(rootDir);
    const configValue = grabFromConfig(frontendFramework);
    if (configValue) {
        frontendFramework = configValue;
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
    }
    else if (fs.existsSync(packageJsonPath)) {
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
        return;
    }
    else if (fs.existsSync(karmaConfigPath)) {
        testingFramework = 'jasmine';
        return;
    }
    else if (fs.existsSync(packageJsonPath)) {
        let fileContent = fs.readFileSync(packageJsonPath, 'utf8');
        if (fileContent.includes('jest')) {
            testingFramework = 'jest';
            return;
        }
        else if (fileContent.includes('jasmine-core')) {
            testingFramework = 'jasmine';
            return;
        }
    }
    testingFramework = 'unknown';
    debug("Detected testingFramework: " + testingFramework, true);
}
function detectTsconfigTarget() {
    var _a, _b;
    let tsconfigPath = path.join(workspaceDir, 'tsconfig.json');
    let scriptTarget;
    let typescriptExtension = '.ts';
    while (tsconfigPath) {
        if (fs.existsSync(tsconfigPath)) {
            let contents = fs.readFileSync(tsconfigPath, 'utf8');
            try {
                let tsconfigJson = JSON.parse(contents);
                scriptTarget = scriptTarget || ((_a = tsconfigJson['compilerOptions']) === null || _a === void 0 ? void 0 : _a['target']);
                const jsx = (_b = tsconfigJson['compilerOptions']) === null || _b === void 0 ? void 0 : _b['jsx'];
                if (jsx) {
                    typescriptExtension = '.tsx';
                }
                tsconfigPath = tsconfigJson['extends'] ? path.join(path.dirname(tsconfigPath), tsconfigJson['extends']) : null;
            }
            catch (error) {
                console.error("Error parsing tsconfig.json. JSON does not support comments. Please remove the comment at the top of " + tsconfigPath + " and try again.");
                console.log("Need help? Email justin@deepunit.ai");
                process.exit(1);
            }
        }
        else {
            console.error("Error: unable to find tsconfig at " + tsconfigPath);
            console.error("The current working director is " + process.cwd());
            console.error("Please notify the appropriate team to add a tsconfig path config");
            console.log("Need help? Email justin@deepunit.ai");
            process.exit(1);
        }
    }
    console.log("Detected ES target: " + scriptTarget);
    return scriptTarget;
}
function detectTypescriptExtension() {
    const configTypescript = grabFromConfig(typescriptExtension);
    if (configTypescript) {
        typescriptExtension = configTypescript;
    }
    else if (typescriptExtension) {
        console.log("found it in the tsconfig");
    }
    else if (frontendFramework === "react") {
        typescriptExtension = '.tsx';
    }
    else if (frontendFramework === 'angular') {
        typescriptExtension = '.ts';
    }
    else {
        typescriptExtension = '.ts';
    }
    console.log("Typescript extension is : " + typescriptExtension);
}
function grabFromConfig(configProperty) {
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
function debug(inputString, doProd = false) {
    let doDebug = false;
    if (doDebug) {
        console.debug(inputString);
    }
    if (doProd) {
        console.log(inputString);
    }
}
function getChangedFiles() {
    const changedFilesCmd = 'git diff --name-only HEAD~1 HEAD';
    const output = (0, child_process_1.execSync)(changedFilesCmd).toString();
    return output.split('\n').filter(Boolean);
}
function getDiff(files) {
    const diffCmd = `git diff --unified=0 HEAD~1 HEAD -- ${files.join(' ')}`;
    return (0, child_process_1.execSync)(diffCmd).toString();
}
function getFileContent(file) {
    if (file === null) {
        return null;
    }
    try {
        const content = fs.readFileSync(file, 'utf-8');
        return content;
    }
    catch (error) {
        if (error instanceof Error) {
            // @ts-ignore
            if (error.code === 'ENOENT') {
                console.warn(`Warning: File ${file} not found`);
            }
            else {
                console.error(error);
                console.error(`An error occurred while trying to read ${file}: ${error}`);
            }
        }
        return null;
    }
}
function getTestVersion(file) {
    let testVersion = '';
    try {
        testVersion = fs.readFileSync(file, 'utf-8');
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Had an error in reading the file, woopsies');
            console.error(file);
            console.error(error);
            console.log("Need help? Email justin@deepunit.ai");
            process.exit(1);
        }
    }
    return testVersion;
}
function getDirectory(file) {
    return path.dirname(file);
}
function getTestName(file) {
    const testFileName = file.split('.').slice(0, -1).join('.') + testExtension;
    return testFileName;
}
function generateTest(diffs, tsFile, tsFileContent, htmlFile, htmlFileContent, testFile, testVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = { 'Content-Type': 'application/json' };
        let data = {
            diffs,
            frontend_framework: frontendFramework,
            testingFramework: testingFramework,
            script_target: scriptTarget,
            version
        };
        if (tsFile && tsFileContent) {
            data.tsFile = { [tsFile]: tsFileContent };
        }
        if (htmlFile && htmlFileContent) {
            data.htmlFile = { [htmlFile]: htmlFileContent };
        }
        if (testFile && testVersion) {
            data.testFile = { [testFile]: testVersion };
        }
        console.log(`Generating test for tsFile: ${tsFile}, htmlFile: ${htmlFile}`);
        const maxRetries = 2;
        const baseDelay = 0; // delay in ms
        for (let i = 0; i <= maxRetries; i++) {
            try {
                const response = yield axios_1.default.post(generateApiPath, data, { headers });
                return response.data;
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error) && error.response) {
                    const statusCode = error.response.status;
                    const delay = baseDelay * Math.pow(2, i); // exponential backoff
                    console.warn(`Received a ${statusCode} error, retrying in ${delay}ms...`);
                    yield new Promise(resolve => setTimeout(resolve, delay));
                }
                else {
                    console.error(`Failed with error: ${error}`);
                    return undefined;
                }
            }
        }
        console.error("Failed after maximum retries");
        return undefined;
    });
}
function prettyPrintJson(jsonObj, doProd = true) {
    debug(JSON.stringify(jsonObj, null, 2), doProd);
}
const errorPattern = {
    'jasmine': /Error: (.*?):(.*?)\n/,
    'jest': /FAIL.*\n.*\n.*\n(.*)/
}[testingFramework];
function fixErrors(file, testVersion, diff, tsFile, tsFileContent) {
    return __awaiter(this, void 0, void 0, function* () {
        let errors = '';
        let attempts = 0;
        if (!errorPattern) {
            throw new Error(`Unsupported testing framework: ${testingFramework}`);
        }
        while (attempts < 7) {
            console.log(' ', '##########################################################', '################### Begin fixing error ###################', '##########################################################');
            const matches = yield runTestErrorOutput(file);
            if (!matches) {
                console.log(`Fixed all errors for ${file}`);
                return [true, errors, false, null];
            }
            const match = matches.pop();
            if (match === undefined) {
                console.log("match was undefined, I don't think this could ever happen, but if it did it could cause an infinite loop");
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
            let fixedTestCode;
            try {
                const response = yield axios_1.default.post(fixErrorApiPath, data, { headers });
                fixedTestCode = response.data.fixed_test;
            }
            catch (error) {
                return [false, errors, true, null];
            }
            fs.writeFileSync(file, fixedTestCode);
            attempts++;
            if (attempts === 7 && matches) {
                console.log(`Unable to fix all errors, resetting any uncommitted changes in ${file}...`);
                (0, child_process_1.execSync)(`git checkout -- ${file}`);
                return [false, errors, false, fixedTestCode];
            }
        }
        return [true, errors, false, null];
    });
}
function runTestErrorOutput(file) {
    let relativeTestFilePath = file;
    process.chdir(rootDir);
    let result;
    let stdout;
    let stderr;
    if (frontendFramework === 'angular') {
        const errorPattern = /Error: (.*?):(.*?)\n/;
        if (workspaceDir) {
            process.chdir(workspaceDir);
            relativeTestFilePath = path.relative(workspaceDir, file);
        }
        result = (0, child_process_1.execSync)(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${relativeTestFilePath}`, { stdio: 'pipe' });
        stdout = result.toString();
        process.chdir(rootDir);
        return stdout.match(errorPattern) || [];
    }
    else if (frontendFramework === 'react') {
        if (workspaceDir) {
            process.chdir(workspaceDir);
            relativeTestFilePath = path.relative(workspaceDir, file);
        }
        //todo: fix this so we get stderr
        result = (0, child_process_1.execSync)(`npx jest ${relativeTestFilePath} --json`, { stdio: ['pipe', 'pipe', 'pipe'] });
        stdout = result.toString();
        //stderr = result.stderr.toString();
        process.chdir(rootDir);
    }
    else {
        throw new Error(`Unsupported frontend framework: ${frontendFramework}`);
    }
    const errorMessages = [];
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
    }
    catch (_a) {
        errorMessages.push(`Failed to parse test output: ${stdout}`);
    }
    return errorMessages;
}
function runTest(file) {
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
            result = (0, child_process_1.execSync)(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${relativeTestFilePath}`, { stdio: 'pipe' });
        }
        else {
            if (workspaceDir) {
                process.chdir(workspaceDir);
            }
            result = (0, child_process_1.execSync)('ng test --browsers=ChromeHeadless --no-watch --no-progress', { stdio: 'pipe' });
        }
        stdout = result.toString();
        process.chdir(rootDir);
    }
    else if (frontendFramework === 'react') {
        if (workspaceDir) {
            process.chdir(workspaceDir);
            relativeTestFilePath = path.relative(workspaceDir, file);
        }
        result = (0, child_process_1.execSync)(`npx jest ${relativeTestFilePath}`, { stdio: 'pipe' });
        stdout = result.toString();
        process.chdir(rootDir);
    }
    else {
        throw new Error(`Unsupported frontend framework: ${frontendFramework}`);
    }
    return stdout;
}
function getInput() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve, reject) => {
        rl.question('Do you want to continue fixing errors? (y/n): ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'n') {
                resolve(false);
            }
            else if (answer.toLowerCase() === 'y') {
                console.log('Y received, continuing execution');
                resolve(true);
            }
            else {
                console.log('Invalid input. Please enter y or n.');
                resolve(getInput());
            }
        });
    });
}
function groupFilesByDirectory(changedFiles) {
    const filesByDirectory = {};
    for (const file of changedFiles) {
        const directory = path.dirname(file);
        if (!filesByDirectory[directory]) {
            filesByDirectory[directory] = [];
        }
        filesByDirectory[directory].push(file);
    }
    return filesByDirectory;
}
function tsAndHtmlFromFile(file, filesInDirectory) {
    const baseFile = path.basename(file, path.extname(file));
    const extension = path.extname(file);
    let correspondingFile = null;
    if (extension === typescriptExtension) {
        correspondingFile = `${baseFile}.html`;
    }
    else if (extension === '.html') {
        correspondingFile = `${baseFile}${typescriptExtension}`;
    }
    let htmlFile = null;
    let tsFile = null;
    if (correspondingFile && filesInDirectory.includes(correspondingFile)) {
        if (extension === typescriptExtension) {
            tsFile = file;
            htmlFile = correspondingFile;
        }
        else {
            tsFile = correspondingFile;
            htmlFile = file;
        }
    }
    else {
        if (extension === typescriptExtension) {
            tsFile = file;
        }
        else {
            htmlFile = file;
        }
    }
    return [tsFile, htmlFile, correspondingFile];
}
function testCode() {
    return __awaiter(this, void 0, void 0, function* () {
        const headers = { 'Content-Type': 'application/json' };
        try {
            const response = yield axios_1.default.post(testApiPath, {}, { headers });
            console.log(response);
        }
        catch (error) {
            console.log(error);
        }
        console.log("Need help? Email justin@deepunit.ai");
        process.exit();
    });
}
function checkIfTestPasses(testFile) {
    console.log(`Checking if ${testFile} passes before attempting to modify it`);
    let output;
    try {
        output = (0, child_process_1.execSync)(`jest ${testFile}`).toString(); // replace with your test runner command
    }
    catch (error) {
        console.error(error);
        console.log(`Error running tests: ${error}`);
        return false;
    }
    console.log(`Output for: ${testFile}`);
    console.log(output);
    if (output.includes('Your test suite must contain at least one test.')) {
        return true; // React will fail on an empty file, but we still want to write a test in this case
    }
    if (output.includes('FAIL') || output.includes('ERROR')) {
        return false;
    }
    return true;
}
function checkIfAngularTestsPass(testFile) {
    console.log(`Checking if all Angular tests pass`);
    let output;
    try {
        output = (0, child_process_1.execSync)(`ng test --browsers=ChromeHeadless --no-watch --no-progress --include=${testFile}`).toString();
    }
    catch (error) {
        console.log(error);
        console.log(`Error running tests: ${error}`);
        return false;
    }
    console.log(`Output for Angular tests`);
    console.log(output);
    if (parseFailedAngularTestOutput(output)) {
        console.log(output);
        console.log(`DeepUnit was unable to run because the above tests are failing. Please fix them if your last commit broke them or deleted their content and let us regenerate new ones`);
        console.log("Need help? Email justin@deepunit.ai");
        process.exit();
    }
    return true;
}
function printSummary(failingTests, testsWithErrors, passingTests, apiErrors, testRunResults) {
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
function doesFileExist(filename) {
    return fs.existsSync(filename);
}
function createFile(filename) {
    // Create a new file
    fs.writeFileSync(filename, '');
    // Run git add on the file
    try {
        (0, child_process_1.execSync)(`git add ${filename}`);
    }
    catch (error) {
        console.error(filename);
        console.error(error);
        console.error(`Error running git add: `);
    }
}
function findFiles(extensions, ignoreExtensions) {
    /**
    Find all files in all nested directories within workspaceDir with the given extensions and ignore files with the given ignoreExtensions.

        Parameters:
    extensions (list): List of extensions to match.
    ignoreExtensions (list): List of extensions to ignore.

        Returns:
    list: List of full paths to files that match the given extensions and do not match the ignoreExtensions.
    */
    const matches = [];
    const walkDir = workspaceDir || 'src'; // replace with actual workspaceDir if needed
    function walk(directory) {
        const files = fs.readdirSync(directory);
        for (const file of files) {
            const fullPath = path.join(directory, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            }
            else if (extensions.some(ext => file.endsWith(ext)) &&
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
function filterFiles(files) {
    const filteredFiles = [];
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
function saveTestsWithErrors(testContentWithErrors) {
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
function parseFailedAngularTestOutput(output) {
    const match = output.match(/TOTAL: (\d+) FAILED, (\d+) SUCCESS/);
    if (match) {
        const failedTests = parseInt(match[1]);
        const successfulTests = parseInt(match[2]);
        console.log(`Matched, found ${failedTests} and also found: ${successfulTests}`);
        return failedTests < 1; // if any tests failed return false
    }
    else {
        const executedMatch = output.match(/Executed (\d+) of/);
        if (executedMatch) {
            return true; // this should occur because we had no tests in the specified file, but there were no other errors in the other files
        }
        else {
            return false; // There was an error in this case
        }
    }
}
function writeTestsToFiles(tests, skip) {
    if (skip) {
        return;
    }
    for (const [testFilePath, testCode] of Object.entries(tests)) {
        save(testFilePath, testCode);
    }
}
function save(testFilePath, testCode) {
    console.log(process.cwd());
    console.log(testFilePath);
    console.log(`Stashing any uncommitted changes in ${testFilePath}...`);
    (0, child_process_1.execSync)(`git stash push -- ${testFilePath}`);
    fs.writeFileSync(testFilePath, testCode);
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let skip = false;
        if (skip) {
            return;
        }
        yield detectWorkspaceDir();
        yield detectProjectType();
        yield detectTestFramework();
        yield detectTsconfigTarget();
        yield detectTypescriptExtension();
        debug("#################################################", true);
        debug("##### Generating unit tests with DeepUnitAI #####", true);
        debug("#################################################", true);
        let changedFiles;
        if (allFiles) {
            changedFiles = findFiles([typescriptExtension, ".html"], [".spec.ts", ".test.tsx", ".test.ts", ".consts.ts", '.module.ts']);
        }
        else {
            changedFiles = getChangedFiles();
        }
        const filteredChangedFiles = filterFiles(changedFiles);
        const filesByDirectory = groupFilesByDirectory(filteredChangedFiles);
        let failingTests = [];
        let testsWithErrors = [];
        let testContentWithErrors = [];
        let passingTests = [];
        let testRunResults = [];
        let apiErrors = [];
        let firstRun = true;
        for (const directory in filesByDirectory) {
            let filesInDirectory = filesByDirectory[directory];
            while (filesInDirectory.length > 0) {
                const file = filesInDirectory.pop();
                if (file === undefined) {
                    continue;
                }
                const testFile = getTestName(file);
                if (firstRun && frontendFramework === "angular") {
                    checkIfAngularTestsPass(testFile);
                    firstRun = false;
                }
                if (!fs.existsSync(testFile)) {
                    fs.writeFileSync(testFile, '');
                }
                else if (frontendFramework !== "angular") {
                    const doesTestPass = checkIfTestPasses(testFile);
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
                if (tsFile) {
                    filesToPass.push(tsFile);
                }
                if (htmlFile) {
                    filesToPass.push(htmlFile);
                }
                const diff = getDiff(filesToPass);
                const tsFileContent = getFileContent(tsFile);
                const htmlFileContent = getFileContent(htmlFile);
                const response = yield generateTest(diff, tsFile, tsFileContent, htmlFile, htmlFileContent, testFile, testVersion);
                let tests;
                if (!response) {
                    apiErrors.push(testFile);
                    continue;
                }
                try {
                    const tests = response['tests'];
                    writeTestsToFiles(tests, false);
                }
                catch (error) {
                    console.error("Caught error trying to writeTestsToFiles");
                    console.error(error);
                    console.error(response);
                    apiErrors.push(testFile);
                }
                const [fixedAllErrors, runResults, apiError, fixedTest] = yield fixErrors(testFile, testVersion, diff, tsFile, tsFileContent);
                if (apiError) {
                    console.log("API error encountered");
                    apiErrors.push(testFile);
                    continue;
                }
                testRunResults.push(`\n     Result for: ${testFile}`);
                testRunResults.push(runResults);
                if (fixedAllErrors) {
                    passingTests.push(testFile);
                }
                else {
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
        console.log("Need help? Email justin@deepunit.ai");
        process.exit(100);
        console.log("Remove the exit");
    });
}
if (require.main === module) {
    main();
}
