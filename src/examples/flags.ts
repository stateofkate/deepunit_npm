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
