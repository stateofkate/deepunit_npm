import { CONFIG } from './Config';

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

export function exitWithError(error: string) {
  console.error(error);
  console.log('Need help? Email support@deepunit.ai');
  process.exit(1);
}
