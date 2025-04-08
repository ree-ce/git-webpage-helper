const esbuild = require('esbuild');
const { join } = require('path');

const isProd = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: !isProd,
  minify: isProd,
};

if (isWatch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('watching...');
  });
} else {
  esbuild.build(buildOptions).catch(() => process.exit(1));
}
