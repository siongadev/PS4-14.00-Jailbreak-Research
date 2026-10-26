"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const source = fs.readFileSync(path.join(__dirname,
  "../probes/clone_history_getrlimit10_v1.js"), "utf8");
const probe = new Function("api", "window", source);

function run(returnValue) {
  const frame = new Uint8Array(0x2000);
  frame.fill(0x37, 0x300, 0x310);
  const calls = [];
  const logs = [];
  const anchor = {};
  const array = [anchor];
  const native = {
    frame,
    frameAddress: 0x200000000,
    wrappers: { getrlimit: 0x80002ca80 },
    call(name, args) {
      calls.push(name);
      if (name === "getpid") return { value: 70, high: 0 };
      assert.strictEqual(name, "getrlimit");
      assert.deepStrictEqual(args, [10, native.frameAddress + 0x300]);
      if (returnValue === 0) {
        const output = new DataView(frame.buffer);
        output.setUint32(0x300, 0x60000000, true);
        output.setUint32(0x304, 0, true);
        output.setUint32(0x308, 0xffffffff, true);
        output.setUint32(0x30c, 0x7fffffff, true);
      }
      return { value: returnValue, high: 0 };
    },
    readErrno() { return 1; }
  };
  const page = { __fw14NativeInvoke: native,
    __fw14ArrayState: { array, a: anchor } };
  const api = { log(message) { logs.push(message); }, markSync() {} };
  const checks = probe(api, page);
  assert.deepStrictEqual(calls, ["getpid", "getrlimit", "getpid"]);
  assert(frame.subarray(0x300, 0x310).every(byte => byte === 0x37));
  return { check: checks[0], logs };
}

const success = run(0);
assert.strictEqual(success.check.status, "pass");
assert.strictEqual(success.check.details.soft, "0x0000000060000000");
assert.strictEqual(success.check.details.hard, "0x7fffffffffffffff");
assert.match(success.logs[0], /soft  1536 MiB/);
assert.match(success.logs[0], /hard  0x7fffffffffffffff/);

const denied = run(-1);
assert.strictEqual(denied.check.status, "fail");
assert.strictEqual(denied.check.details.errno, 1);
assert.match(denied.logs[0], /query failed/);

console.log("Read-only limit query formats both words and restores its frame");
