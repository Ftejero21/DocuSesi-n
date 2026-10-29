import { build } from 'esbuild';

const production = process.argv.includes('--production');

try {
  await build({
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
    sourcemap: !production,
    minify: production,
    logLevel: 'info'
  });
} catch (e) {
  console.error(e);
  process.exit(1);
}
