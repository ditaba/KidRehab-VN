/** End-to-end API tests. Requires a PostgreSQL database (see DATABASE_URL_TEST in README). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  testEnvironment: 'node',
  globalSetup: './global-setup.js',
  testTimeout: 30000,
};
