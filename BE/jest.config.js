module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.spec.js',
  ],
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
  ],
  coverageDirectory: 'coverage',
};
