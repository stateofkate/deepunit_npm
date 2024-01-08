import fnmatch
import os
import subprocess
import sys

import requests
import json
import re


### Automatically Detected Project configs ###
### To manually set these you must comment out the detect_* function calls at the start of the githook ###
workspace_dir = "" #If your package.json is not in the root directory set this to the directory it is located in. The autodetect function will reset it to the root directory if package.json is not found in the directory specified
frontend_framework = "angular"
testing_framework = "jasmine"
script_target = "ES2015"
typescript_extension = ".ts"
test_extension = ".spec.ts"
root_dir = os.getcwd()

### Manually set project configs ###
verbose_test_output = False
verbose_logging = False
all_files = False # grab list of files from last commit or recursively search all directories in the project for .ts or html files
ignore_directories = ['dumper']  # Add paths to directories to never write tests for
default_ignore = ['node_modules', '.angular', '.idea', 'dist', 'git_hooks', ]  # Paths that most projects will never want to unit test
ignored_files = ['index.html', 'index.tsx', 'polyfills.ts', 'test.ts', 'main.ts', 'environments/environment.ts', 'environments/environment.prod.ts']  # ignore file paths ending in these names
config_file_path = "deepunit.config.json"

# Api paths
use_prod = True
prod_base = "https://dumper.adaptable.app"
API_PATH = prod_base + "/generate-test/new" if use_prod else "http://localhost:8080/generate-test/new"
FIX_ERROR_API_PATH = prod_base + "/generate-test/fix-error" if use_prod else "http://localhost:8080/generate-test/fix-error"
test_API_PATH = prod_base + "/generate-test/test-code" if use_prod else "http://localhost:8080/generate-test/test-code"
version = "0.2.0"

def detect_workspace_dir():
  global workspace_dir
  if workspace_dir:
    return
  # Check if the configuration file exists
  config_workspace_dir = grab_from_config('workspace_dir')
  package_json_path = 'package.json'
  if config_workspace_dir:
    package_json_path = os.path.join(config_workspace_dir, 'package.json')

  # Check if 'package.json' exists in the 'repoPath'
  if os.path.isfile(package_json_path):
    workspace_dir = config_workspace_dir
    debug("Detected workspace_dir: " + workspace_dir)
    # If package.json exists, leave workspace_dir as it is
    pass
  else:
    # If package.json does not exist, set workspace_dir to an empty string
    workspace_dir = ""
  debug("Detected repo located at workspace_dir: " + workspace_dir, verbose_logging)

def detect_project_type():
  os.chdir(root_dir)
  angular_json_path = 'angular.json'
  package_json_path = 'package.json'

  # If workspace_dir is not empty, join the path
  if workspace_dir:
    angular_json_path = os.path.join(workspace_dir, 'angular.json')
    package_json_path = os.path.join(workspace_dir, 'package.json')

  global frontend_framework
  global typescript_extension
  global test_extension
  if os.path.exists(angular_json_path):
    frontend_framework = 'angular'
    typescript_extension = '.ts'
    test_extension = '.spec.ts'
    debug("Detected frontend_framework: " + frontend_framework, True)
    debug("Detected typescript_extension: " + typescript_extension, True)
    debug("Detected test_extension: " + test_extension, True)
    return
  elif os.path.exists(package_json_path):
    with open(package_json_path) as f:
      package_json = json.load(f)
      dependencies = package_json.get('dependencies', {})
      devDependencies = package_json.get('devDependencies', {})
      if 'react' in dependencies or 'react' in devDependencies:
        frontend_framework = 'react'
        typescript_extension = '.tsx'
        test_extension = '.test.tsx'
        debug("Detected frontend_framework: " + frontend_framework, True)
        debug("Detected typescript_extension: " + typescript_extension, True)
        debug("Detected test_extension: " + test_extension, True)
        return
      if 'angular/common' in dependencies or 'angular/common' in devDependencies:
        frontend_framework = 'angular'
        typescript_extension = '.ts'
        test_extension = '.spec.ts'
        debug("Detected frontend_framework: " + frontend_framework, True)
        debug("Detected typescript_extension: " + typescript_extension, True)
        debug("Detected test_extension: " + test_extension, True)
        return
  frontend_framework = 'unknown'
  debug('WARNING: Unable to detect frontend framework, typescript extension or test extension', True)

def detect_test_framework():
  global testing_framework
  jest_config_path = 'jest.config.js'
  karma_config_path = 'karma.conf.js'
  package_json_path = 'package.json'
  # If workspace_dir is not empty, join the path
  if workspace_dir:
    jest_config_path = os.path.join(workspace_dir, 'jest.config.js')
    karma_config_path = os.path.join(workspace_dir, 'karma.conf.js')
    package_json_path = os.path.join(workspace_dir, 'package.json')
  if os.path.exists(jest_config_path):
    testing_framework = 'jest'
    return
  elif os.path.exists(karma_config_path):
    testing_framework = 'jasmine'
    return
  elif os.path.exists(package_json_path):
    with open(package_json_path) as f:
      file_content = f.read()
      if 'jest' in file_content:
        testing_framework = 'jest'
        return
      elif 'jasmine-core' in file_content:
        testing_framework = 'jasmine'
        return
  testing_framework = 'unknown'
  debug("Detected testing_framework: " + testing_framework,True)

def detect_tsconfig_target():
  global script_target
  tsconfig_path = os.path.join(workspace_dir, 'tsconfig.json')
  if os.path.exists(tsconfig_path):
    with open(tsconfig_path) as f:
      contents = f.read()
      try:
        tsconfig_json = json.loads(contents)
        script_target = tsconfig_json.get('compilerOptions', {}).get('target')
      except json.JSONDecodeError:
        debug("\033[31m🚨 Error Alert! 🚨\033[0m", True)
        debug("\033[31m🚨 Error Alert! 🚨\033[0m", True)
        debug("\033[31m🚨 Error Alert! 🚨\033[0m", True)
        debug("\033[31m🚨 Error Alert! 🚨\033[0m", True)
        debug("\033[31mError parsing tsconfig.json. JSON does not support comments. Please remove the comment at the top of " + tsconfig_path + " and try again.\033[0m")
        exit()
  else:
    script_target = None
  debug("Detected ES target: " + str(script_target), True)
  return script_target

def grab_from_config(config_property):
  if os.path.isfile(config_file_path):
    with open(config_file_path, 'r') as config_file:
      config = json.load(config_file)

      # Check if the 'repoPath' property exists in the configuration
      if config_property in config:
        config_value = config['workspace_dir']
        return config_value
  return None

def get_changed_files():
  changed_files_cmd = ["git", "diff", "--name-only", "HEAD~1", "HEAD"]
  return subprocess.check_output(changed_files_cmd).decode().splitlines()

def get_diff(files):
  # Filter out None values
  files = [file for file in files if file is not None]
  diff_cmd = ["git", "diff", "--unified=0", "HEAD~1", "HEAD", "--"] + files
  return subprocess.check_output(diff_cmd).decode()

def get_file_content(file):
  if file is None:
    return None
  try:
    with open(file, 'r') as f:
      content = f.read()
    return content
  except FileNotFoundError:
    debug(f"Warning: File {file} not found", verbose_logging)
    return None
  except Exception as e:
    debug(f"An error occurred while trying to read {file}: {str(e)}", verbose_logging)
    return None

def debug(input_string, do_prod=False):
  do_debug = False
  if do_debug:
    debug(input_string)
  if do_prod:
    print(str(input_string))
def get_directory(file):
  return os.path.dirname(file)

def get_test_name(file):
  test_file_name = file.rsplit('.', 1)[0] + test_extension
  return test_file_name

def get_test_version(file):
  try:
    with open(file, 'r') as f:
      test_version = f.read()
  except IOError:
    debug('Had an error in reading the file, woopsies', True)
    debug(file, True)
    test_version = ''

  return test_version

def generate_test(diffs, ts_file, ts_file_content, html_file, html_file_content, test_file, test_version):
  headers = {'Content-Type': 'application/json'}
  data = {'diffs': diffs, 'tsFile': {ts_file: ts_file_content}, 'htmlFile': { html_file: html_file_content}, 'testFile': { test_file: test_version}, 'frontend_framework': frontend_framework, 'testing_framework': testing_framework, 'script_target': script_target, 'version': version}
  debug("     Generating test for ts_file: " + str(ts_file) + ' html_file: ' + str(html_file), True)

  try:
    response = requests.post(API_PATH, headers=headers, data=json.dumps(data))
    response.raise_for_status()
  except requests.exceptions.HTTPError as e:
    if response.status_code < 200 or response.status_code > 299:  # If a 503 error occurs, try again
      debug(f"     Received a {response.status_code} error, retrying...", True)
      try:
        response = requests.post(API_PATH, headers=headers, data=json.dumps(data))
        response.raise_for_status()
      except requests.exceptions.HTTPError as e:
        debug("     Failed again with error: " + str(e), True)
        return None, False
    else:
      debug("     Failed with error: " + str(e), True)
      return None, False

  return json.loads(response.text), True

def pretty_print_json(json_obj, do_prod):
  for key, value in json_obj.items():
    if isinstance(value, dict):
      pretty_print_json(value, do_prod)
    else:
      debug(f"{key}:", do_prod)
      debug(value, do_prod)

def write_tests_to_files(tests, skip):
  if skip:
    return
  for test_file_path, test_code in tests.items():
    save(test_file_path, test_code)

def save(test_file_path, test_code):
  debug(os.getcwd(), verbose_logging)
  debug(test_file_path, verbose_logging)
  debug(f"Stashing any uncommitted changes in {test_file_path}...", True)
  subprocess.run(["git", "stash", "push", "--", test_file_path], check=True)
  with open(test_file_path, 'w') as test_file:
    test_file.write(test_code)

# def run_tests(tests):
#   os.chdir(workspace_dir)
#   error_files = []
#   error_messages = []
#   for test_file_path in tests.keys():
#     relative_test_file_path = os.path.relpath(test_file_path, start=workspace_dir)
#     result = subprocess.run(["ng", "test", "--browsers=ChromeHeadless", "--no-watch", "--no-progress", "--include={}".format(relative_test_file_path)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
#     debug(result.stdout.decode(), verbose_test_output)
#     error_files.append(test_file_path)
#     error_messages.append(result.stdout.decode())
#   os.chdir(root_dir)
#   return error_files, error_messages

def fix_errors(file, test_version, diff, ts_file, ts_file_content):
  errors = ''
  attempts = 0
  error_pattern = {
    'jasmine': r'Error: (.*?):(.*?)\n',
    'jest': r'FAIL.*\n.*\n.*\n(.*)'
  }.get(testing_framework)
  if not error_pattern:
    raise ValueError(f"Unsupported testing framework: {testing_framework}")

  while attempts < 7:
    debug(' ', verbose_logging)
    debug('##########################################################', verbose_logging)
    debug('################### Begin fixing error ###################', verbose_logging)
    debug('##########################################################', verbose_logging)
    matches = run_test_error_output(file)
    debug("matches", verbose_logging)
    # for m in matches:
    #   print('######## next match')
    #   print(m)
    #debug(matches, verbose_logging) uncomment this
    if not matches:  # If there are no more errors, break the loop
      debug("Fixed all errors for " + file, True)
      return True, errors, False, None

    match = matches.pop()  # pop the last error from the stack
    error_string = str(match[0]) + str(match[1]) if testing_framework == "jasmine" else match
    debug("     Fixing error: " + error_string, True)
    headers = {'Content-Type': 'application/json'}
    data = {'error_message': error_string, 'test_code': test_version, 'diff': diff, 'ts_file_name': ts_file, 'ts_file_content': ts_file_content, 'script_target': script_target, 'frontend_framework': frontend_framework, 'testing_framework': testing_framework, 'version': version}
    response = requests.post(FIX_ERROR_API_PATH, headers=headers, data=json.dumps(data))
    debug(response, verbose_logging)
    try:
      debug('response', verbose_logging)
      debug(response, verbose_logging)
      fixed_test_code = json.loads(response.text)['fixed_test']
    except KeyError:
      return False, errors, True, None
    debug("test_version after fixing error", verbose_logging)
    debug(fixed_test_code, verbose_logging)
    os.chdir(root_dir)
    with open(file, 'w') as test_file:
      test_file.write(fixed_test_code)
    debug(errors, verbose_test_output)
    #get_input()
    attempts+=1
    if attempts == 7 and matches: # If there are still errors after 7 attempts
      debug(f"Unable to fix all errors, resetting any uncommitted changes in {file}...", True)
      subprocess.run(["git", "checkout", "--", file], check=True)
      return False, errors, False, fixed_test_code
  debug(errors, verbose_test_output)
  return True, errors, False, fixed_test_code

def run_test_error_output(file):
  relative_test_file_path = file  # Initialize with the original file path
  os.chdir(root_dir)

  if frontend_framework == 'angular':
    error_pattern = r'Error: (.*?):(.*?)\n'
    if workspace_dir:
      os.chdir(workspace_dir)
      relative_test_file_path = os.path.relpath(file, start=workspace_dir)
    debug(relative_test_file_path, verbose_logging)
    debug(os.getcwd(), verbose_logging)
    result = subprocess.run(["ng", "test", "--browsers=ChromeHeadless", "--no-watch", "--no-progress", "--include={}".format(relative_test_file_path)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    os.chdir(root_dir)
    output = result.stdout.decode()
    debug(output, verbose_test_output)
    return re.findall(error_pattern, output)

  elif frontend_framework == 'react':
    if workspace_dir:
      os.chdir(workspace_dir)
      relative_test_file_path = os.path.relpath(file, start=workspace_dir)
    result = subprocess.run(["npx", "jest", "{}".format(relative_test_file_path), "--json"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    os.chdir(root_dir)

  else:
    raise ValueError(f"Unsupported frontend framework: {frontend_framework}")

  stdout = result.stdout.decode()
  stderr = result.stderr.decode()
  os.chdir(root_dir)

  # If there's an error message in stderr, add it to the error messages list
  error_messages = []
  if stderr:
    error_messages.append(stderr)

  # Parse JSON output and extract error messages
  try:
    output_json = json.loads(stdout)
  except json.JSONDecodeError:
    error_messages.append("Failed to parse test output: " + stdout)
  else:
    for suite in output_json.get('testResults', []):
      for assertion in suite.get('assertionResults', []):
        if assertion.get('status') == 'failed':
          error_messages.extend(assertion.get('failureMessages', []))

  return error_messages

def run_test(file):
  relative_test_file_path = file  # Initialize with the original file path

  if workspace_dir:  # Only calculate relative path if workspace_dir is not empty
    relative_test_file_path = os.path.relpath(file, start=workspace_dir)

  if frontend_framework == 'angular':

    command = []
    if does_file_exist(file): #If the file does not exist we will get an error, so check first before using the include flag
      if workspace_dir:
        os.chdir(workspace_dir)
      result = subprocess.run(["ng", "test", "--browsers=ChromeHeadless", "--no-watch", "--no-progress", "--include={}".format(relative_test_file_path)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    else:
      if workspace_dir:
        os.chdir(workspace_dir)
      result = subprocess.run(["ng", "test", "--browsers=ChromeHeadless", "--no-watch", "--no-progress"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    os.chdir(root_dir)

  elif frontend_framework == 'react':
    if workspace_dir:
      os.chdir(workspace_dir)
    result = subprocess.run(["npx", "jest", "{}".format(relative_test_file_path)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    os.chdir(root_dir)

  else:
    raise ValueError(f"Unsupported frontend framework: {frontend_framework}")

  output = result.stdout.decode()
  os.chdir(root_dir)
  return output

def get_input():
  user_input = subprocess.check_output('read -p "Do you want to continue fixing errors? (y/n): " decision; echo $decision', shell=True).decode().strip()
  if user_input.lower() == 'n':
    return False
  elif user_input.lower() == 'y':
    debug('Y received, continuing execution', True)
    return True
  else:
    debug('Invalid input. Please enter y or n.', True)
    get_input()


def group_files_by_directory(changed_files):
  files_by_directory = {}

  for file in changed_files:
    directory = get_directory(file)

    if directory not in files_by_directory:
      files_by_directory[directory] = []

    files_by_directory[directory].append(file)

  return files_by_directory

def ts_and_html_from_file(file, files_in_directory):
  # If this is a ts file, get corresponding html or vice versa
  base_file, extension = os.path.splitext(file)
  if extension == typescript_extension:
    corresponding_file = base_file + '.html'
  elif extension == '.html':
    corresponding_file = base_file + typescript_extension
  else:
    corresponding_file = None
  # If there is a corresponding file and it's in files_in_directory, remove it
  html_file = None
  ts_file = None
  if corresponding_file and corresponding_file in files_in_directory:
    if extension == typescript_extension:
      ts_file = file
      html_file = corresponding_file
    else:
      ts_file = corresponding_file
      html_file = file
  else:
    if extension == typescript_extension:
      ts_file = file
    else:
      html_file = file
  return ts_file, html_file, corresponding_file

def test_code():
  headers = {'Content-Type': 'application/json'}
  response = requests.post(test_API_PATH, headers=headers)
  debug(response, verbose_logging)
  exit()


def check_if_test_passes(test_file):
  debug("     Checking if " + test_file + " passes before attempting to modify it", True)
  output = run_test(test_file)
  debug('Output for: ' + test_file, verbose_test_output)
  debug(output, verbose_test_output)
  if 'Your test suite must contain at least one test.' in output:
    return True # React will fail on an empty file, but we still want to write a test in this case
  if 'FAIL' in output:
    return False
  elif 'ERROR' in output:
    return False
  return True

def check_if_angular_tests_pass(test_file):
  debug("     Checking if all angular tests pass", True)
  debug(test_file, verbose_logging)
  debug(os.getcwd(), verbose_logging)
  output = run_test(test_file)

  if not parse_failed_angular_test_output(output):
    debug(output, True)
    debug("DeepUnit was unable to run because the above tests are failing. Please fix them if your last commit broke them or deleted their content and let us regenerate new ones",True)
    exit()
  debug('     Output for angular tests')
  debug(output, verbose_test_output)
  return True


def print_summary(failing_tests, tests_with_errors, passing_tests, api_errors, test_run_results):
  if test_run_results:
    debug("Here are the final results from running the tests:")
    for result in test_run_results:
      debug(result, True)
  debug("#####################################", True)
  debug("##### Summary of DeepUnitAI Run #####", True)
  debug("#####################################", True)

  if failing_tests:
    debug("\nThe following tests were failing after your last commit. You will need to fix them before we can write new tests for you.:", True)
    for test in failing_tests:
      debug('     ' + test, True)

  if tests_with_errors:
    debug("\nWe generated tests for the following files but could not fix some errors in them, please manually resolve them:", True)
    for test in tests_with_errors:
      debug('     ' + test, True)

  if passing_tests:
    debug("\nWe successfully generated tests for the following files, and they pass without errors:", True)
    for test in passing_tests:
      debug('     ' + test, True)

  if api_errors:
    debug("\nWe had api errors while generating the following tests, see the logs above.\nTry again and if you're seeing this frequently bother Justin to find a fix this:", True)
    for test in api_errors:
      debug('     ' + test, True)
  debug('\n', True)
def does_file_exist(filename):
  """Check if a file exists."""
  return os.path.isfile(filename)

def create_file(filename):
  os.chdir(root_dir)
  """Create a file."""
  open(filename, 'a').close()
  # Run git add on the file
  subprocess.run(['git', 'add', filename])

def find_files(extensions, ignore_extensions):
  """
  Find all files in all nested directories within workspace_dir with the given extensions and ignore files with the given ignore_extensions.

  Parameters:
  extensions (list): List of extensions to match.
  ignore_extensions (list): List of extensions to ignore.

  Returns:
  list: List of full paths to files that match the given extensions and do not match the ignore_extensions.
  """
  os.chdir(root_dir)
  matches = []
  if not workspace_dir:
    walk_dir = 'src'
  else:
    walk_dir = workspace_dir
  for root, dirnames, filenames in os.walk(walk_dir):
    for extension in extensions:
      for filename in fnmatch.filter(filenames, '*' + extension):
        if not any(filename.endswith(ignore) for ignore in ignore_extensions):
          full_path = os.path.join(root, filename)
          matches.append(full_path)
  return matches

def filter_files(files):
  """
  Filter out files that are within certain directories or match certain filenames.

  Parameters:
  files (list): List of file paths.

  Returns:
  list: List of file paths that are not within the ignore_directories, default_ignore directories, and do not match filenames in ignored_files.
  """
  filtered_files = []
  combined_ignore_dirs = [os.path.join(workspace_dir, dir) if workspace_dir else dir for dir in ignore_directories + default_ignore]
  for file in files:
    if not any(ignore_dir in file for ignore_dir in combined_ignore_dirs) and not any(file.endswith(ignore_file) for ignore_file in ignored_files):
      filtered_files.append(file)
  return filtered_files

def save_tests_with_errors(test_content_with_errors):
  """
  Save tests from test_content_with_errors to the filesystem.

  Parameters:
  test_content_with_errors (list): List of dictionaries containing test information.
  """
  os.chdir(root_dir)
  for test_info in test_content_with_errors:
    for test, content in test_info.items():
      with open(test, 'w') as file:
        file.write(content)
def parse_failed_angular_test_output(output):
  """
  Parse the test output to find if tests all pass.

  Parameters:
  output (str): The test output.
  """
  match = re.search(r"TOTAL: (\d+) FAILED, (\d+) SUCCESS", output)
  if match:
    failed_tests = int(match.group(1))
    successful_tests = int(match.group(2))
    debug("matched, found " + str(failed_tests) + " and also found: " + str(successful_tests), verbose_logging)
    return failed_tests < 1 # if any tests failed return false
  else:
    executed_match = re.findall(r"Executed (\d+) of", output)
    if executed_match:
      return True # this should occur because we had no tests in the specified file, but there were no other errors in the other files
    else:
      return False # There was an error in this case

def main():
  #test_code()
  skip = False
  #skip = True
  if skip:
    return
  detect_workspace_dir()
  detect_project_type()
  detect_test_framework()
  detect_tsconfig_target()
  debug("#################################################", True)
  debug("##### Generating unit tests with DeepUnitAI #####", True)
  debug("#################################################", True)
  if frontend_framework == "angular":
    debug('', verbose_logging)
    #check_if_angular_tests_pass('src')
  if all_files:
    changed_files = find_files([typescript_extension, ".html"], [".spec.ts", ".test.tsx", ".test.ts", ".consts.ts", '.module.ts'])
    #print(changed_files)
    #changed_files = ["passport/src/app/gym-setup/gym-setup.component.ts"] # remove this when done testing
  else:
    changed_files = get_changed_files()
  filtered_changed_files = filter_files(changed_files)
  # so we have the changed files, we need to seperate them by directory and
  files_by_directory = group_files_by_directory(filtered_changed_files)

  failing_tests = []
  tests_with_errors = []
  test_content_with_errors = []
  passing_tests = []
  test_run_results = []
  api_errors = []
  first_run = True
  for directory in files_by_directory:
    # Access the files in this directory
    files_in_directory = files_by_directory[directory]
    while files_in_directory:
      file = files_in_directory.pop()
      debug("Running for file: " + file, verbose_logging)
      # Get test
      test_file = get_test_name(file)
      if first_run and frontend_framework == "angular": # Even if we specify a single test to run angular will report any errors in all tests, so we must guarantee there are not other errors before attempting to generate tests
        check_if_angular_tests_pass(test_file)
        first_run = False
      if not does_file_exist(test_file):
        create_file(test_file)
      elif not frontend_framework == "angular":
        does_test_pass = check_if_test_passes(test_file)
        if not does_test_pass:
          failing_tests.append(test_file)
          continue
      test_version = get_test_version(test_file) # todo: fix error when .spec.ts file does not exist, use the found_test for this
      # If this is a ts file, get corresponding html or vice versa and remove from stack. We should end up with ts_file and html_file and ts_file
      # implementation here
      ts_file, html_file, corresponding_file = ts_and_html_from_file(file, files_in_directory)
      if corresponding_file and corresponding_file in files_in_directory:
        files_in_directory.remove(corresponding_file)
      # If the file does not exist create it, otherwise check if the test broke in the last commit and abort if so

      diff = get_diff([ts_file, html_file])
      ts_file_content = get_file_content(ts_file)
      html_file_content = get_file_content(html_file)
      debug("#### @@@@ debug all file data", verbose_logging)
      debug("#### @@@@ file", verbose_logging)
      debug(file, verbose_logging)
      debug("#### @@@@ test_file", verbose_logging)
      debug(test_file, verbose_logging)
      debug("#### @@@@ test_version", verbose_logging)
      debug(test_version, verbose_logging)
      debug("#### @@@@ ts_file", verbose_logging)
      debug(ts_file, verbose_logging)
      debug('#### @@@@ html_file', verbose_logging)
      debug(html_file, verbose_logging)
      debug('#### @@@@ corresponding_file', verbose_logging)
      debug(corresponding_file, verbose_logging)
      debug('#### @@@@ diff', verbose_logging)
      debug(diff, verbose_logging)
      debug('#### @@@@ ts_file_content', verbose_logging)
      debug(ts_file_content, verbose_logging)
      debug('#### @@@@ html_file_content', verbose_logging)
      debug(html_file_content, verbose_logging)
      debug("#### @@@@ Done", verbose_logging)
      json_data, made_request = generate_test(diff, ts_file, ts_file_content, html_file, html_file_content, test_file, test_version)
      if not made_request:
        debug("Looks like we ran into an error generating the test. Here's the output", True)
        api_errors.append(test_file)
        debug(json_data, True)
        continue
      try:
        tests = json_data['tests']
        debug(tests, verbose_logging)
        pretty_print_json(tests, verbose_logging)
        write_tests_to_files(tests, skip=False)
      except KeyError:
        api_errors.append(test_file)
        debug("Looks like we ran into an error generating the test. Here's the output", True)
        debug(json_data, True)
      fixed_all_errors, run_results, api_error, fixed_test = fix_errors(test_file, test_version, diff, ts_file, ts_file_content) #todo: maybe this is not right?
      if api_error:
        debug("API error encountered", True)
        api_errors.append(test_file)
        continue
      test_run_results.append('\n     Result for: ' + test_file)
      test_run_results.append(run_results)
      if fixed_all_errors:
        passing_tests.append(test_file)
      elif not fixed_all_errors:
        tests_with_errors.append(test_file)
        if frontend_framework == "angular":
          test_content_with_errors.append({'test': test_file, 'test_content': fixed_test})
  debug("completed the fir loop", verbose_logging)
  save_tests_with_errors(test_content_with_errors)
  print_summary(failing_tests, tests_with_errors, passing_tests, api_errors, test_run_results)
  exit(100)
  debug("remove he exite", verbose_logging)

if __name__ == "__main__":
  main()
