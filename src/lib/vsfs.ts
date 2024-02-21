import nodefs, {MakeDirectoryOptions, NoParamCallback, PathOrFileDescriptor, WriteFileOptions} from "fs";

// creates a log class singleton that has fs functions. It should perform fs function but also ensure that when running in a vs code context it creates a VS code friendly path.
const originalFs = {
  writeFileSync: nodefs.writeFileSync,
  readFileSync: nodefs.readFileSync,
  existsSync: nodefs.existsSync,
  mkdirSync: nodefs.mkdirSync,
  unlinkSync: nodefs.unlinkSync,
  rm: nodefs.rm,
};
export type PathLike = nodefs.PathLike;

export class FileSystem {
  private static instance: FileSystem;
  public PathLike
  
  private constructor() {}

  public static getInstance(): FileSystem {
    if (!FileSystem.instance) {
      FileSystem.instance = new FileSystem();
    }
    return FileSystem.instance;
  }
  public handlePathLikeForVSCode(path: PathLike): PathLike {
    console.log('type of PathLike: ' + typeof path)
  
    if(typeof path !== 'string') {
      console.log('not a string: ' + typeof path)
      return path;
    }
    // Check if the code is running within VS Code by looking for VS Code specific environment variables
    if (process.env.VSCODE_CWD) {
      try {
        // Dynamically import the 'vscode' module
        const vscode = require('vscode');
        
        // If there's an active workspace, make the path relative to the workspace root
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
          const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
          const relativePath = vscode.workspace.asRelativePath(path, true);
          console.log(`Path converted to relative: ${relativePath}`);
          return relativePath;
        } else {
          // If no workspace is open, log and return the path as is
          console.log('No workspace detected. Returning original path.');
          return path;
        }
      } catch (e) {
        console.log('error caught, returning path')
        return path;
      }
    }
    console.log('no environemnt variable, returning path')
    return path;
  }
  
  public handlePathForVSCode(path: PathOrFileDescriptor): PathOrFileDescriptor {
    console.log('type of PathOrFileDescriptor: ' + typeof path)
    if(typeof path === 'string') {
      return this.handlePathLikeForVSCode(path as PathLike) as PathOrFileDescriptor
    }
    return path;
  }
  public writeFileSync(file: PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options?: WriteFileOptions): void {
    file = this.handlePathForVSCode(file)
    originalFs.writeFileSync(file, data, options);
  }
  
  public readFileSync(path: PathOrFileDescriptor, options?: { encoding?: null, flag?: string }): Buffer;
  public readFileSync(path: PathOrFileDescriptor, options: { encoding: BufferEncoding, flag?: string }): string;
  public readFileSync(path: PathOrFileDescriptor, encoding: BufferEncoding): string;
  public readFileSync(path: PathOrFileDescriptor): Buffer;
  
  // Unified method implementation
  public readFileSync(path: PathOrFileDescriptor, options?: { encoding?: BufferEncoding | null, flag?: string } | BufferEncoding): string | Buffer {
    path = this.handlePathForVSCode(path);
    
    if (typeof options === 'string' || options === undefined) {
      return originalFs.readFileSync(path, options as BufferEncoding);
    } else {
      return originalFs.readFileSync(path, options as { encoding?: BufferEncoding, flag?: string });
    }
  }

  public existsSync(path: PathLike): boolean {
    path = this.handlePathLikeForVSCode(path);
    return originalFs.existsSync(path)
  }
  
  public mkdirSync(
    path: PathLike,
    options: MakeDirectoryOptions & {
      recursive: true;
    }): string | undefined {
    path = this.handlePathLikeForVSCode(path)
    return originalFs.mkdirSync(path, options)
  }
  public unlinkSync(path: PathLike): void {
    path = this.handlePathLikeForVSCode(path)
    originalFs.unlinkSync(path)
  }
  
  public rm(path: PathLike, callback: NoParamCallback): void {
    path = this.handlePathLikeForVSCode(path)
    originalFs.rm(path, callback)
  }
}

const FILESYSTEM = FileSystem.getInstance();
export default FILESYSTEM;

let fs: {
  writeFileSync: typeof FILESYSTEM.writeFileSync;
  readFileSync: typeof FILESYSTEM.readFileSync;
  existsSync: typeof FILESYSTEM.existsSync;
  mkdirSync: typeof FILESYSTEM.mkdirSync;
  unlinkSync: typeof FILESYSTEM.unlinkSync
  rm: typeof FILESYSTEM.rm
  
};

fs = {
  writeFileSync: FILESYSTEM.writeFileSync.bind(FILESYSTEM),
  readFileSync: FILESYSTEM.readFileSync.bind(FILESYSTEM),
  existsSync: FILESYSTEM.existsSync.bind(FILESYSTEM),
  mkdirSync: FILESYSTEM.mkdirSync.bind(FILESYSTEM),
  unlinkSync: FILESYSTEM.unlinkSync.bind(FILESYSTEM),
  rm: FILESYSTEM.rm.bind(FILESYSTEM)
};
