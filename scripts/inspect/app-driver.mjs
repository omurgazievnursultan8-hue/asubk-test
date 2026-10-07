// Interactive driver for exploratory QA of the Заявки module.
// Keeps one logged-in browser open and executes snippets sent over local HTTP:
//   node scripts/inspect/app-driver.mjs &        (PORT=9333 by default)
//   curl -s localhost:9333 --data-binary @snippet.js
// A snippet is the body of an async function with `page`, `ctx`, `lib` in scope;
// its return value comes back as JSON. Every snippet + result is appended to
// .auth/app-driver.log so a session can be replayed / cited later.
import { createServer } from 'http';
import { appendFileSync } from 'fs';
import * as lib from './app-lib.mjs';

const PORT = +(process.env.PORT || 9333);
const { ctx, page } = await lib.open({ headless: process.env.HEADED ? false : true });
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;

createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', async () => {
    let out;
    try {
      const fresh = await import(`./app-lib.mjs?t=${Date.now()}`); // pick up lib edits without restart
      const v = await new AsyncFn('page', 'ctx', 'lib', body)(page, ctx, fresh);
      out = { ok: true, v };
    } catch (e) {
      out = { ok: false, err: String(e?.message || e).slice(0, 2000) };
    }
    appendFileSync('.auth/app-driver.log',
      `\n### ${new Date().toISOString()}\n${body}\n--> ${JSON.stringify(out).slice(0, 4000)}\n`);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(out, null, 1));
  });
}).listen(PORT, '127.0.0.1', () => console.log('driver ready on', PORT));
