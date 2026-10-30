// Usage: node repro.mjs
//
// Generates the test modules, then measures each rspack version below in its
// own process and prints a comparison table.
//
// Each measurement starts a watch build, then edits src/entry.js REBUILDS
// times. For each rebuild it times the rebuild itself,
// `compilation.getWarnings()`, and `stats.toJson({ warnings: true })` (what dev
// servers call after each build).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const PACKAGES = ['rspack-2.1', 'rspack-2.2'];

if (process.argv[2] === '--measure') {
  measure(process.argv[3]);
} else {
  main();
}

function main() {
  execFileSync(process.execPath, ['generate.mjs'], { stdio: 'inherit' });

  const rows = PACKAGES.map((pkg) => {
    const output = execFileSync(process.execPath, ['repro.mjs', '--measure', pkg], {
      encoding: 'utf8',
    });
    const result = JSON.parse(output.trim().split('\n').at(-1));
    console.log(`measured ${result.label}`);
    return result;
  });

  console.log(`\nMedian of ${rows[0].rebuilds} rebuilds:\n`);
  console.table(
    Object.fromEntries(
      rows.map((r) => [
        r.label,
        {
          warnings: r.count,
          'rebuild (ms)': r.rebuildMs,
          'getWarnings() (ms)': r.getWarningsMs,
          'toJson({ warnings }) (ms)': r.toJsonMs,
        },
      ]),
    ),
  );
}

function measure(pkg) {
  const REBUILDS = Number(process.env.REBUILDS ?? 10);
  const require = createRequire(import.meta.url);
  const { rspack } = require(pkg);
  const version = require(`${pkg}/package.json`).version;

  const compiler = rspack({
    mode: 'development',
    context: import.meta.dirname,
    entry: './src/entry.js',
    output: { path: `${import.meta.dirname}/dist` },
    devtool: false,
    stats: 'none',
  });

  const entry = 'src/entry.js';
  const original = fs.readFileSync(entry, 'utf8');
  const results = [];
  let rebuild = 0;
  let started = 0;

  const watching = compiler.watch({ aggregateTimeout: 50 }, (err, stats) => {
    if (err) throw err;
    const rebuildMs = performance.now() - started;

    let t = performance.now();
    const count = stats.compilation.getWarnings().length;
    const getWarningsMs = performance.now() - t;

    t = performance.now();
    stats.toJson({ all: false, warnings: true, errors: true });
    const toJsonMs = performance.now() - t;

    if (rebuild > 0) results.push({ rebuildMs, getWarningsMs, toJsonMs, count });
    if (rebuild++ < REBUILDS) {
      setTimeout(() => {
        started = performance.now();
        fs.writeFileSync(entry, `${original}// ${rebuild}\n`);
      }, 200);
    } else {
      watching.close(() => {
        fs.writeFileSync(entry, original);
        const median = (k) => {
          const s = results.map((r) => r[k]).sort((a, b) => a - b);
          return Math.round(s[Math.floor(s.length / 2)]);
        };
        console.log(
          JSON.stringify({
            label: `@rspack/core ${version}`,
            count: results[0].count,
            rebuildMs: median('rebuildMs'),
            getWarningsMs: median('getWarningsMs'),
            toJsonMs: median('toJsonMs'),
            rebuilds: results.length,
          }),
        );
      });
    }
  });
}
