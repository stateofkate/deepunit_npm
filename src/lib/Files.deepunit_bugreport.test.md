## Bug Report

### Bug Description
The `filteredFiles` array is not populated correctly in the `filterFiles` method of the `Files` class. As a result, some files that should be filtered out are not being ignored.

### Bug Reason
The `ignoredFiles` array is not being populated correctly in the `filterFiles` method. Instead of adding ignored files to the array, the array itself is being returned without any files.

### Test Case
To reproduce this bug, follow these steps:
1. Create a test file with the name `test.ts` in the `src` directory.
2. Run the `Files.getFilesToTest()` method.

Expected behavior: The `filteredFiles` array should not contain the `src/test.ts` file.
Actual behavior: The `filteredFiles` array contains the `src/test.ts` file.

### Code
```typescript
// File: src/lib/Files.ts

...

  public static filterFiles(files: string[]): { filteredFiles: string[]; ignoredFiles: string[] } {
    const filesWithValidExtensions = this.filterExtensions(files);
    const filteredFiles: string[] = [];
    const ignoredFiles: string[] = [];

    for (const file of filesWithValidExtensions) {
      if (!CONFIG.ignoredDirectories.some((ignoreDir) => Files.isParentAncestorOfChild(ignoreDir, file)) && !CONFIG.ignoredFiles.some((ignoreFile) => file == ignoreFile)) {
        filteredFiles.push(file);
      } else {
        ignoredFiles; // This line should be ignoredFiles.push(file)
      }
    }
    return { filteredFiles, ignoredFiles };
  }

...
```

### Proposed Fix
To fix this bug, replace the line `ignoredFiles;` with `ignoredFiles.push(file);` in the `filterFiles` method of the `Files` class.

```diff
  public static filterFiles(files: string[]): { filteredFiles: string[]; ignoredFiles: string[] } {
    const filesWithValidExtensions = this.filterExtensions(files);
    const filteredFiles: string[] = [];
    const ignoredFiles: string[] = [];

    for (const file of filesWithValidExtensions) {
      if (!CONFIG.ignoredDirectories.some((ignoreDir) => Files.isParentAncestorOfChild(ignoreDir, file)) && !CONFIG.ignoredFiles.some((ignoreFile) => file == ignoreFile)) {
        filteredFiles.push(file);
      } else {
-        ignoredFiles;
+        ignoredFiles.push(file);
      }
    }
    return { filteredFiles, ignoredFiles };
  }
```