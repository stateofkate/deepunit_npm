<details>
<summary>
 Bug 1 (:red_square:): The method `getFilesToTest()` does not return the correct output when the `filesToFilter` array is empty.
</summary>

  - **Bug:** The `getFilesToTest()` method does not handle the case when the `filesToFilter` array is empty. As a result, the method does not set the `flagType` correctly and does not return the expected output.

  - **Issue:** The condition `if (filesToFilter) { ... }` should be changed to `if (filesToFilter && filesToFilter.length > 0) { ... }` to correctly handle the case when the `filesToFilter` array is empty.

  - **Solution:** Change the condition `if (filesToFilter) { ... }` to `if (filesToFilter && filesToFilter.length > 0) { ... }` in the `getFilesToTest()` method.

  - **Test Cases:** 

    - Input: `filesToFilter = []`
      Expected Output: `{ filesFlagReturn: { readyFilesToTest: [], flagType: '' } }`

</details>

<details>
<summary>
 Bug 2 (:yellow_square:): The method `getChangedFiles()` does not handle the case when the `gitRoot` variable is undefined.
</summary>

  - **Bug:** The `getChangedFiles()` method assumes that the `gitRoot` variable is always defined. However, if the `git rev-parse --show-toplevel` command fails or returns an empty string, the `gitRoot` variable will be undefined and cause an error.

  - **Issue:** The `getChangedFiles()` method does not handle the case when the `gitRoot` variable is undefined.

  - **Solution:** Add a check for the undefined value of the `gitRoot` variable and handle it appropriately in the `getChangedFiles()` method.

  - **Test Cases:** 

    - Input: `gitRoot = undefined, currentDir = 'path/to/current/dir'`
      Expected Output: `[]`

</details>

<details>
<summary>
 Bug 3 (:green_square:): The method `filterFiles()` does not correctly filter out ignored files.
</summary>

  - **Bug:** The `filterFiles()` method does not correctly filter out ignored files. If a file matches an ignored file name exactly, it is not filtered out as expected.

  - **Issue:** The `filterFiles()` method uses the `==` operator to compare the file path with ignored file names. This operator does not perform a strict comparison and does not match the file path exactly.

  - **Solution:** Change the `==` operator to the `===` operator in the condition `file == ignoreFile` in the `filterFiles()` method to perform a strict comparison.

  - **Test Cases:** 

    - Input: `files = ['file1.ts', 'file2.ts'], ignoredFiles = ['file2.ts']`
      Expected Output: `{ filteredFiles: ['file1.ts'], ignoredFiles: ['file2.ts'] }`

</details>