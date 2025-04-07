const esbuild = require('esbuild');

async function build() {
  await esbuild.build({
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: './dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
  });
}

build().catch(err => {
  process.stderr.write(err.stderr);
  process.exit(1);
});
