import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setupEnv.ts'],
    // Route test files share one real Postgres database and truncate it in
    // beforeEach (see tests/testDb.ts) — running files in parallel causes
    // concurrent TRUNCATEs to deadlock. Force single-file-at-a-time execution.
    fileParallelism: false,
  },
});
