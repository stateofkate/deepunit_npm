#!/usr/bin/env node
import * as path from 'path';
import * as fs from 'fs';

console.log("Arrr matey, the world I be plundering!");
console.log("Arrr matey, the world I be plundering!");

/** Automatically Detected Project configs
 * These configs are first pulled from deepunit.config.json, if absent we will try to use the detect*() function to autodetect
 */
let configPath: string = '';
let workspace_dir: string = ""; //If your package.json is not in the root directory set this to the directory it is located in. The autodetect function will reset it to the root directory if package.json is not found in the directory specified
let frontend_framework: string = "";
let testing_framework: string = "";
let script_target: string = "";
let typescript_extension: string = "";
let test_extension: string = "";
let root_dir: string = process.cwd();

/**
 * Manually set configs
 */
let verbose_test_output: boolean = false;
let verbose_logging: boolean = false;
let all_files: boolean = false; // grab list of files from last commit or recursively search all directories in the project for .ts or html files
let ignore_directories: string[] = ['dumper'];  // Add paths to directories to never write tests for
let default_ignore: string[] = ['node_modules', '.angular', '.idea', 'dist', 'git_hooks'];  // Paths that most projects will never want to unit test
let ignored_files: string[] = ['index.html', 'index.tsx', 'polyfills.ts', 'test.ts', 'main.ts', 'environments/environment.ts', 'environments/environment.prod.ts'];  // ignore file paths ending in these names
let config_file_path: string = "deepunit.config.json";

// Api paths
let use_prod: boolean = true;
let prod_base: string = "https://dumper.adaptable.app";
let API_PATH: string = use_prod ? `${prod_base}/generate-test/new` : "http://localhost:8080/generate-test/new";
let FIX_ERROR_API_PATH: string = use_prod ? `${prod_base}/generate-test/fix-error` : "http://localhost:8080/generate-test/fix-error";
let test_API_PATH: string = use_prod ? `${prod_base}/generate-test/test-code` : "http://localhost:8080/generate-test/test-code";
let version: string = "0.2.0";

function detect_workspace_dir() {
    process.chdir(root_dir);
    // Check if the configuration file exists
    let config_workspace_dir = grab_from_config('workspace_dir');
    const packageJson = "package.json"
    let package_json_path = packageJson;
    if (config_workspace_dir) {
        package_json_path = path.join(config_workspace_dir, 'package.json');
    }

    if (config_workspace_dir && fs.existsSync(package_json_path)) {
        workspace_dir = config_workspace_dir;
        debug("Detected workspace_dir: " + workspace_dir);
        // If package.json exists, leave workspace_dir as it is
    } else if (fs.existsSync(packageJson)) {
        //Looks like it wasn't in the config path, but is in the current working directory
        debug("Looks like it wasn't in the config path, but is in the current working directory", verbose_logging)
        workspace_dir = "";
    } else {
        console.error("Unable to find package.json at " + package_json_path)
        console.error("Current working directory is " + process.cwd())
        console.error("Please resolve the path and update the workspace_dir in deepunit.config.json")
        workspace_dir = "";
        process.exit(1) //We can't continue until the user fixes this error
    }
    debug("Detected repo located at workspace_dir: " + workspace_dir, verbose_logging);
}

function detect_project_type() {
    process.chdir(root_dir);
    const configValue = grab_from_config(frontend_framework)
    if(configValue) {
        frontend_framework = configValue
        return;
    }
    let angular_json_path = 'angular.json';
    let package_json_path = 'package.json';

    // If workspace_dir is not empty, join the path
    if (workspace_dir) {
        angular_json_path = path.join(workspace_dir, 'angular.json');
        package_json_path = path.join(workspace_dir, 'package.json');
    }

    if (fs.existsSync(angular_json_path)) {
        frontend_framework = 'angular';
        debug("Detected frontend_framework: " + frontend_framework, true);
        return;
    } else if (fs.existsSync(package_json_path)) {
        let package_json = JSON.parse(fs.readFileSync(package_json_path, 'utf8'));
        let dependencies = package_json['dependencies'] || {};
        let devDependencies = package_json['devDependencies'] || {};
        if ('react' in dependencies || 'react' in devDependencies) {
            frontend_framework = 'react';
            debug("Detected frontend_framework: " + frontend_framework, true);
            return;
        }
        if ('angular/common' in dependencies || 'angular/common' in devDependencies) {
            frontend_framework = 'angular';
            debug("Detected frontend_framework: " + frontend_framework, true);
            return;
        }
    }
    frontend_framework = 'unknown';
    debug('WARNING: Unable to detect frontend framework, typescript extension', true);
}
function detect_test_framework() {
    let jest_config_path = 'jest.config.js';
    let karma_config_path = 'karma.conf.js';
    let package_json_path = 'package.json';

    // If workspace_dir is not empty, join the path
    if (workspace_dir) {
        jest_config_path = path.join(workspace_dir, 'jest.config.js');
        karma_config_path = path.join(workspace_dir, 'karma.conf.js');
        package_json_path = path.join(workspace_dir, 'package.json');
    }

    if (fs.existsSync(jest_config_path)) {
        testing_framework = 'jest';
        return;
    } else if (fs.existsSync(karma_config_path)) {
        testing_framework = 'jasmine';
        return;
    } else if (fs.existsSync(package_json_path)) {
        let file_content = fs.readFileSync(package_json_path, 'utf8');
        if (file_content.includes('jest')) {
            testing_framework = 'jest';
            return;
        } else if (file_content.includes('jasmine-core')) {
            testing_framework = 'jasmine';
            return;
        }
    }

    testing_framework = 'unknown';
    debug("Detected testing_framework: " + testing_framework, true);
}
function detect_tsconfig_target() {
    let tsconfig_path = path.join(workspace_dir, 'tsconfig.json');
    if (fs.existsSync(tsconfig_path)) {
        let contents = fs.readFileSync(tsconfig_path, 'utf8');
        try {
            let tsconfig_json = JSON.parse(contents);
            script_target = tsconfig_json['compilerOptions']?.['target'];
            const jsx = tsconfig_json['compilerOptions']?.['jsx'];
            if(jsx) {
                typescript_extension = '.tsx'
            }
        } catch (error) {
            debug("\x1b🚨 Error Alert! 🚨\x1b", true);
            debug("\x1b🚨 Error Alert! 🚨\x1b", true);
            debug("\x1b🚨 Error Alert! 🚨\x1b", true);
            debug("\x1b🚨 Error Alert! 🚨\x1b", true);
            debug("\x1bError parsing tsconfig.json. JSON does not support comments. Please remove the comment at the top of " + tsconfig_path + " and try again.\x1b");
            process.exit();
        }
    } else {
        console.error("Error: unable to find tsconfig at " + tsconfig_path)
        console.error("The current working director is " + process.cwd())
        console.error("Please both justin to add a tsconfig path config")
        process.exit(1)
    }
    debug("Detected ES target: " + script_target, true);
    return script_target;
}

function  detectTypescriptExtension() {
    const configTypescript = grab_from_config(typescript_extension)
    if(configTypescript) {
        typescript_extension = configTypescript
    } else if (typescript_extension) {
        console.log("found it in the tsconfig")
    } else if (frontend_framework === "react") {
        typescript_extension = '.tsx'
    } else if(frontend_framework === 'angular') {
        typescript_extension = '.ts'
    }
    console.log("Typescript extension is : " + typescript_extension)
}
function grab_from_config(config_property: string): string | null {
    if (fs.existsSync(config_file_path)) {
        let config = JSON.parse(fs.readFileSync(config_file_path, 'utf8'));

        // Check if the 'repoPath' property exists in the configuration
        if (config_property in config) {
            let config_value = config[config_property];
            return config_value;
        }
    }
    return null;
}
function debug(input_string: string, do_prod = false) {
    let do_debug = false;
    if (do_debug) {
        console.debug(input_string);
    }
    if (do_prod) {
        console.log(input_string);
    }
}
async function main() {
    let skip = false;
    if (skip) {
        return;
    }
    await detect_workspace_dir();
    await detect_project_type();
    await detect_test_framework();
    await detect_tsconfig_target();
    await detectTypescriptExtension()
    debug("#################################################", true);
    debug("##### Generating unit tests with DeepUnitAI #####", true);
    debug("#################################################", true);

    let changed_files: string[];
    if (all_files) {
        changed_files = find_files([typescript_extension, ".html"], [".spec.ts", ".test.tsx", ".test.ts", ".consts.ts", '.module.ts']);
    } else {
        changed_files = get_changed_files();
    }
    const filtered_changed_files = filter_files(changed_files);
    const files_by_directory = group_files_by_directory(filtered_changed_files);

    let failing_tests: string[] = [];
    let tests_with_errors: string[] = [];
    let test_content_with_errors: any[] = [];
    let passing_tests: string[] = [];
    let test_run_results: string[] = [];
    let api_errors: string[] = [];
    let first_run = true;

    for (const directory in files_by_directory) {
        let files_in_directory = files_by_directory[directory];
        while (files_in_directory.length > 0) {
            let file = files_in_directory.pop();
            debug("Running for file: " + file, verbose_logging);
            let test_file = get_test_name(file);
            // Rest of your logic here...
        }
    }
    // Rest of your logic here...
}

if (require.main === module) {
    main();
}
