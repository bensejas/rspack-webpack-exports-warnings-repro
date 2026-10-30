# rspack `webpackExports` warning cost repro

Since `@rspack/core` 2.2.0 ([#15249](https://github.com/web-infra-dev/rspack/pull/15249)), rspack works out
which exports a dynamic import uses when it's destructured from `await Promise.all([...])`. As a result,
existing `webpackExports` magic comments in that pattern now raise "Useless magic comments" warnings.
These warnings are rendered on every rebuild, including for unchanged modules.

```sh
npm install
npm run repro
```

`generate.mjs` writes 300 modules with 8 methods each, and each method looks like this:

```js
const [serialized, { Response0_0 }] = await Promise.all([
  this.http.post('/client0/method0', JSON.stringify(req)),
  import(/* webpackExports: 'Response0_0' */ '../types/Response0_0.js'),
]);
```

`repro.mjs` runs everything: it calls `generate.mjs`, then measures 2.1.2 and 2.2.9, each in its own
process, and prints a comparison table. Each measurement starts a watch
build, edits `src/entry.js` 10 times, and for each rebuild times the rebuild, `compilation.getWarnings()`
and `stats.toJson({ warnings: true })`.

Set `CLIENTS`, `METHODS` or `REBUILDS` to change the size.
