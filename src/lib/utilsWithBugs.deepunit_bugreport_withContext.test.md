<details>
<summary>
Bug 1 (:red_square:): Incorrect usage of `expect` function
</summary>

- **Bug:** The `expect` function throws an error when a value is not truthy, but the condition is reversed, resulting in an error being thrown when a value is truthy.

- **Issue:**
```typescript
export function expect(truthyVal: any): any {
  if (CONFIG.doProd && !truthyVal) { // !truthyVal should be truthyVal
    // ...
  }

  return truthyVal;
}
```

- **Solution:**
The condition in the `expect` function should be `truthyVal` instead of `!truthyVal`.

```typescript
export function expect(truthyVal: any): any {
  if (CONFIG.doProd && truthyVal) {
    // ...
  }

  return truthyVal;
}
```

- **Test Cases:** N/A

</details>

<details>
<summary>
Bug 2 (:yellow_square:): Incorrect condition in `validateVersionIsUpToDate` function
</summary>

- **Bug:** The condition in the `validateVersionIsUpToDate` function is incorrect, causing the `needsUpdating` variable to be set incorrectly.

- **Issue:**
```typescript
if (versionNumbers.length < 2 || latestVersionNumbers.length < 2 || versionNumbers[0] < latestVersionNumbers[0] || versionNumbers[1] < latestVersionNumbers[1]) {
  needsUpdating = true;
}
```

- **Solution:**
The condition in the `if` statement should compare the parsed version numbers as integers instead of strings.

```typescript
if (versionNumbers.length < 2 || latestVersionNumbers.length < 2 || parseInt(versionNumbers[0]) < parseInt(latestVersionNumbers[0]) || parseInt(versionNumbers[1]) < parseInt(latestVersionNumbers[1])) {
  needsUpdating = true;
}
```

- **Test Cases:** N/A

</details>

<details>
<summary>
Bug 3 (:green_square:): Unused import statement for `Printer` in `utilsWithBugs.ts`
</summary>

- **Bug:** The `Printer` object is imported from `'./Printer'` but is not used in the code.

- **Issue:**
```typescript
import { Color, Printer } from './Printer';
```

- **Solution:**
Remove the unused import statement for `Printer`.

- **Test Cases:** N/A

</details>