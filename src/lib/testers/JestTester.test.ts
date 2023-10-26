import { expectedJsonObject, jsonObject } from './JestTester.test.consts';
import { JestTester } from './JestTester';

describe('extractJSONs', () => {
  it('should extract JSONs correctly', () => {
    const text = 'hey, this is json {"hey": "a string with {{{ brackets", "another": "key"} and another json {"simple": "json"} in text';
    const expected = ['{"hey": "a string with {{{ brackets", "another": "key"}', '{"simple": "json"}'];
    expect(JestTester.extractJSONs(text)).toEqual(expected);
  });

  it('should handle nested JSONs', () => {
    const text = 'example {"outer": {"inner": "value"}} end';
    const expected = ['{"outer": {"inner": "value"}}'];
    expect(JestTester.extractJSONs(text)).toEqual(expected);
  });

  it('should handle multiple JSONs', () => {
    const text = 'first {"a": 1} second {"b": 2}';
    const expected = ['{"a": 1}', '{"b": 2}'];
    expect(JestTester.extractJSONs(text)).toEqual(expected);
  });

  it('should return an empty array if no JSON is present', () => {
    const text = 'no json here';
    expect(JestTester.extractJSONs(text)).toEqual([]);
  });

  it('should handle complex jest example', () => {
    expect(JestTester.extractJSONs(jsonObject)).toEqual([expectedJsonObject]);
  });
});
