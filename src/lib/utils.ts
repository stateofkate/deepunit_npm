import { CONFIG } from '../main';
import { Api } from './Api';
import { createInterface } from 'readline';
import { Color, Printer } from './Printer';
import { execSync } from 'child_process';

/**
 * Throw error when a value is not truthy (ie. undefined, null, 0, ''), when we are not in production
 * @param truthyVal - any value we expect to be truthy
 */
export function expect(truthyVal: any): any {
  if (CONFIG.doProd && !truthyVal) {
    type FalsyTypeKeys = 'boolean' | 'number' | 'string' | 'object' | 'undefined' | 'NaN';
    const falsyTypes: Record<FalsyTypeKeys, string> = {
      boolean: "boolean 'false'",
      number: "number '0'",
      string: 'empty string',
      object: "'null'",
      undefined: "'undefined'",
      NaN: "'NaN'",
    };
    const typeKey = (Number.isNaN(truthyVal) ? 'NaN' : typeof truthyVal) as FalsyTypeKeys; //typeof NaN is number, so we must handle NaN
    const error = new Error(`DEBUG: Value was expected to be truthy but was falsy, falsy type is ${falsyTypes[typeKey]}`);
    console.error(error.message);
    console.error(error.stack);
  }

  return truthyVal;
}

/**
 * Throw error when a value is truthy (ie. NOT undefined, null, 0, ''), when we are not in production
 * @param falsyVal - any value we expect to be falsy
 */
export function expectNot(falsyVal: any): any {
  expect(!falsyVal);

  return falsyVal;
}

/**
 * Console.log only when we are not in production
 * @param input
 */
export function debugMsg(...input: any) {
  if (!CONFIG.doProd) {
    console.log(input);
  }
}

/**
 * Check if object is empty
 * @param obj
 * @returns
 */
export function isEmpty(obj: Object) {
  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop)) {
      return false;
    }
  }

  return true;
}

/**
 * If DeepUnit is run with the --f, --file or --files flag it will looks for a list of files and return it as an array
 * Example npm run deepunit -- --f main.ts,subfolder/number.ts will return ['main.ts', 'subfolder/number.ts']
 */
export function getFilesFlag(): string[] {
  const args = process.argv.slice(2);
  let files: string[] = [];

  args.forEach((arg, index) => {
    if ((arg === '--f' || arg === '--file' || arg === '--files') && index + 1 < args.length) {
      files = files.concat(args[index + 1].split(','));
    }
  });

  return files;
}

export function getFeedbackFlag(): boolean {
  let result : boolean = false;
  //check what argv contains
  const arg:string = process.argv[2];
  console.log(process.argv);
  // will change this so that
  // conditions for feedback: strlen(arg) > 10;
  if ((arg === '--feedback')){
    result = true;
    return result;
  }
  return result;
}

export async function promptUserInput(prompt:string,backToUser:string): Promise<string>{
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt,
      (answer) => {
        console.log(backToUser);
        rl.close();
        resolve(answer);
      }
    );
  });
}


/**
 * Get whether we are doing all files or only changed files
 */
export function getGenerateAllFilesFlag(): boolean {
  const args = process.argv.slice(2);

  let result = false;
  args.forEach((arg) => {
    if (arg === '--a' || arg === '--all') {
      result = true;
    }
  });

  return result;
}

export function exitWithError(error: string) {
  console.error(error);
  console.log('Need help? Email support@deepunit.ai');
  process.exit(1);
}

export async function validateVersionIsUpToDate(): Promise<void> {
  const { latestVersion } = await Api.getLatestVersion();
  const versionRegex = new RegExp(/^\d+\.\d+\.\d+$/);
  let needsUpdating;
  if (versionRegex.test(latestVersion.trim()) && versionRegex.test(CONFIG.version.trim())) {
    const latestVersionNumbers = latestVersion.split('.');
    const versionNumbers = CONFIG.version.split('.');

    if (versionNumbers.length < 2 || latestVersionNumbers.length < 2 || versionNumbers[0] < latestVersionNumbers[0] || versionNumbers[1] < latestVersionNumbers[1]) {
      needsUpdating = true;
    }
  } else {
    exitWithError('Unable to process version.');
  }

  if (needsUpdating) {
    console.log('\n' + Color.red('DeepUnit is running an outdated version. We no longer support this version.'));
    console.log('Please upgrade by running:');
    console.log(Color.yellow('npm install [package-name]@latest -D'));
    console.log('or by typing "y" and then pressing enter.');
    const wantsToUpdate = await getYesOrNoAnswer('Update DeepUnit?');
    if (wantsToUpdate) {
      try {
        console.log('Updating deepunit...');
        installPackage('deepunit@latest', true);
      } catch (error) {
        exitWithError(`Unable to run 'npm install -D deepunit@latest': ${error}`);
      }
    } else {
      // they don't want to update, to bad
      process.exit(100);
    }
  }
}

export async function getYesOrNoAnswer(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const yesAnswers = ['y', 'yes'];

  return new Promise((resolve) => {
    rl.question(prompt + ' (type y/n):', (answer) => {
      if (yesAnswers.includes(answer.trim().toLowerCase())) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

export function installPackage(newPackage: string, isDevDep?: boolean): void {
  const stdout = execSync(`npm install ${isDevDep ? '-D ' : ''}${newPackage}`);
  console.log(stdout.buffer.toString());
}
