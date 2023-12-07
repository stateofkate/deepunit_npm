
        <details>
          <summary>
            Bug 1 (:red_square:): The function `expect` does not throw an error when the value is falsy and we are not in production.
      </summary>

      - **Issue:** The `expect` function only logs an error message to the console when the value is falsy and we are not in production.
      - **Function:** expect
      - **Solution:** The `expect` function should throw an error when the value is falsy and we are not in production.
      - **Test Cases:**
      - `expect(false);` should throw an error.
      - `expect(0);` should throw an error.
      - `expect('');` should throw an error.
      - `expect(null);` should throw an error.
      - `expect(undefined);` should throw an error.
      - `expect(NaN);` should throw an error.

      </details>

      <details>
    <summary>
    Bug 2 (:red_square:): The function `expectNot` does not throw an error when the value is truthy and we are not in production.
    </summary>

    - **Bug:** The `expectNot` function does not throw an error when the value is truthy and we are not in production.
    - **Function:** expectNot
    - **Issue:** The `expectNot` function only logs an error message to the console when the value is truthy and we are not in production.
    - **Solution:** The `expectNot` function should throw an error when the value is truthy and we are not in production.
    - **Test Cases:**
      - `expectNot(true);` should throw an error.
      - `expectNot(1);` should throw an error.
      - `expectNot('test');` should throw an error.
      - `expectNot({});` should throw an error.
      - `expectNot([]);` should throw an error.
      - `expectNot({ prop: 'value' });` should throw an error.

    </details>
