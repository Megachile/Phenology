module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    '*.js',
    '!jest.config.js',
    '!coverage/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};