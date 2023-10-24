import { CONFIG } from './Config';
import { Api, ClientCode } from './Api';
import { createInterface } from 'readline';
import { Color, Printer } from './Printer';
import { execSync } from 'child_process';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { Arguments } from 'yargs';

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
  if (!CONFIG.doProd && !CONFIG.prodTesting) {
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

export function exitWithError(error: string) {
  console.error(error);
  console.log('Need help? Email support@deepunit.ai');
  Api.sendAnalytics('Client Errored: ' + error, ClientCode.ClientErrored);
  process.exit(1);
}

export async function validateVersionIsUpToDate(): Promise<void> {
  const { latestVersion } = await Api.getLatestVersion();
  const versionRegex = new RegExp(/^\d+\.\d+\.\d+$/);
  let needsUpdating;
  if (versionRegex.test(latestVersion.trim()) && versionRegex.test(CONFIG.getVersion().trim())) {
    const latestVersionNumbers = latestVersion.split('.');
    const versionNumbers = CONFIG.getVersion().split('.');

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
      Api.sendAnalytics('Client Exited: User decided to not update DeepUnit using the default command', ClientCode.ClientExited);
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

/**
 * Flags
 */

interface ParsedArgs extends Arguments {
  f?: string;
  file?: string;
  files?: string;
  a?: boolean;
  all?: boolean;
}

export function setupYargs() {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]\n\nWithout any flags, it will find all files with changes in it starting with unstaged files, and then staged files.')
    .option('f', {
      alias: ['file', 'files'],
      type: 'string',
      description: 'Test only files that match pattern. Example: --f */main.ts,subfolder/number.ts,src/**',
    })
    .option('a', {
      alias: ['all'],
      type: 'boolean',
      description: 'Generate all files in the project that can be tested.',
    })
    .help()
    .alias('h', 'help');
}

export function getFilesFlag(): string[] | undefined {
  const argv = setupYargs().argv as ParsedArgs;

  if (argv.f || argv.file || argv.files) {
    const files = argv.f || argv.file || argv.files;
    return typeof files === 'string' ? files.split(',') : undefined;
  }

  return undefined;
}

export function getGenerateAllFilesFlag(): boolean {
  const argv = setupYargs().argv as ParsedArgs;
  return !!(argv.a || argv.all);
}
