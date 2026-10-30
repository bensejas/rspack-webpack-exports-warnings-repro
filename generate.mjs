// Generates CLIENTS client modules with METHODS methods each. Every method
// loads its response type with a `webpackExports` comment and destructures it
// from `await Promise.all([...])`. Since rspack 2.2 that destructuring is
// statically analysed, so each `import()` emits a "Useless magic comments"
// warning.
import fs from 'node:fs';

const CLIENTS = Number(process.env.CLIENTS ?? 300);
const METHODS = Number(process.env.METHODS ?? 8);

fs.rmSync('src', { recursive: true, force: true });
fs.mkdirSync('src/types', { recursive: true });
fs.mkdirSync('src/clients', { recursive: true });

const index = [];
for (let c = 0; c < CLIENTS; c++) {
  const methods = [];
  for (let m = 0; m < METHODS; m++) {
    const type = `Response${c}_${m}`;
    fs.writeFileSync(
      `src/types/${type}.js`,
      `export class ${type} { static deserialize(x) { return Object.assign(new ${type}(), x); } }\n`,
    );
    methods.push(`
  async method${m}(req) {
    const [serialized, { ${type} }] = await Promise.all([
      this.http.post('/client${c}/method${m}', JSON.stringify(req)),
      import(/* webpackExports: '${type}' */ '../types/${type}.js'),
    ]);
    return ${type}.deserialize(serialized);
  }`);
  }
  fs.writeFileSync(
    `src/clients/client${c}.js`,
    `export class Client${c} {\n  constructor(http) { this.http = http; }${methods.join('\n')}\n}\n`,
  );
  index.push(`export { Client${c} } from './clients/client${c}.js';`);
}
fs.writeFileSync('src/index.js', index.join('\n') + '\n');
fs.writeFileSync('src/entry.js', `import * as clients from './index.js';\nconsole.log(Object.keys(clients).length);\n`);
console.log(`generated ${CLIENTS} clients x ${METHODS} methods = ${CLIENTS * METHODS} dynamic imports`);
