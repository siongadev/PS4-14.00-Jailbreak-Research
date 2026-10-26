"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const manifest = require("../probes/font_face_load_control_v2.json");
const source = fs.readFileSync(path.join(__dirname, "../probes/font_face_load_control_v2.js"), "utf8");
const styles = [];
const faces = [];

class MockFontFace {
  constructor(family) {
    this.family = family;
    this.status = "loaded";
  }
  get loaded() { return Promise.resolve(); }
  load() {
    void this.then;
    return Promise.resolve();
  }
}

global.FontFace = MockFontFace;
global.document = {
  body: { offsetHeight: 1 },
  createElement: () => ({
    textContent: "",
    remove() {
      const index = styles.indexOf(this);
      if (index >= 0) styles.splice(index, 1);
    }
  }),
  head: {
    appendChild(style) {
      styles.push(style);
      const family = /font-family: ([^;]+)/.exec(style.textContent)[1];
      faces.push(new MockFontFace(family));
    }
  },
  fonts: {
    [Symbol.iterator]: () => faces[Symbol.iterator]()
  }
};

async function main() {
  const before = Object.getOwnPropertyDescriptor(MockFontFace.prototype, "then");
  const run = new Function("api", '"use strict";\n' + source);
  const checks = await run({mark: () => Promise.resolve(), isActive: () => true});
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.deepStrictEqual(checks.map(check => check.status), ["pass", "pass", "pass"]);
  assert.deepStrictEqual(checks.map(check => check.details.getter_calls_after), [1, 2, 3]);
  for (const check of checks) {
    assert.ok(Object.values(check.details).every(value =>
      value === null || ["string", "number", "boolean"].includes(typeof value)));
  }
  assert.strictEqual(styles.length, 0);
  assert.deepStrictEqual(Object.getOwnPropertyDescriptor(MockFontFace.prototype, "then"), before);
  console.log("Font-face control returns flat checks and restores prototype/styles");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
