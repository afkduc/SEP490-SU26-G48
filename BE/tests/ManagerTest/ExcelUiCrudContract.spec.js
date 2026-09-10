const { test, expect } = require('@jest/globals');
const cases = require('./ExcelUiCrudCases.json');

test.each(cases)('$module.$method — $title', (scenario) => {
  expect(Object.keys(scenario.inputs).length).toBeGreaterThan(0);
  expect(Boolean(scenario.expectedOutput) !== Boolean(scenario.expectedError)).toBe(true);
  expect(scenario.logMessage).toBe('N/A');
  expect(scenario.type).toMatch(/^[NAB]$/);
});
