// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    client: 'src/client.ts',
    rls: 'src/rls/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  outDir: 'dist',
  clean: true,
});
