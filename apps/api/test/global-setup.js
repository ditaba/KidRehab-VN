/* Migrates a dedicated test database and loads the demo seed (which clears existing rows) before the e2e suite. */
const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const url = process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/kidrehab_test?schema=public';
  if (!/test/i.test(url)) throw new Error(`Refusing to reset a non-test database: ${url}`);
  process.env.DATABASE_URL = url;
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'e2e-test-secret';
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' };
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'ignore' });
  execSync('npx ts-node --transpile-only prisma/seed.ts', { cwd, env, stdio: 'ignore' });
};
