import { multiply } from './testUtils';
import { checkIfNumber } from './subfolder/number';

// Mock the checkIfNumber module
jest.mock('./subfolder/number');

describe('multiply', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // Restore all mocks after each test
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return 0 if the numbers are not real', () => {
    // Setup: Mock the checkIfNumber function to return false
    (checkIfNumber as jest.Mock).mockReturnValue(false);

    // Action: Call the multiply function with non-real numbers
    const result = multiply(3, 'abc' as any);

    // Assertion: Check if the result is 0
    expect(result).toBe(0);
  });

  it('should return the product of the two numbers if they are real', () => {
    // Setup: Mock the checkIfNumber function to return true
    (checkIfNumber as jest.Mock).mockReturnValue(true);

    // Action: Call the multiply function with real numbers
    const result = multiply(3, 2);

    // Assertion: Check if the result is the product of the two numbers
    expect(result).toBe(6);
  });
});
