
export function getFilesFlag(): string[] {
  const args = process.argv.slice(2);
  let files: string[] = [];
  args.forEach((arg, index) => {
    if ((arg === '--f' || arg === '--file' || arg === '--files') && index + 1 < args.length) {
      files = files.concat(args[index + 1].split(','));
    }
  });
  console.log('heya')
  return files;
}
