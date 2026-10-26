"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const source = fs.readFileSync(path.join(__dirname,
  "../probes/clone_history_memory_headroom_v1.js"), "utf8");
const probe = new Function("api", "window", source);

function run(mapReturn) {
  const frame = new Uint8Array(0xa000);
  frame.fill(0x37);
  const calls = [];
  const logs = [];
  const anchor = {};
  const array = [anchor];
  const native = {
    frame,
    frameAddress: 0x200000000,
    wrappers: { getrlimit: 0x80002ca80, sysctl: 0x80002ca90 },
    call(name, args) {
      calls.push(name);
      if (name === "getpid") return {value: 70, high: 0};
      const view = new DataView(frame.buffer);
      if (name === "getrlimit") {
        assert.deepStrictEqual(args, [10, native.frameAddress + 0x300]);
        view.setUint32(0x300, 0x60000000, true);
        view.setUint32(0x304, 0, true);
        view.setUint32(0x308, 0xffffffff, true);
        view.setUint32(0x30c, 0x7fffffff, true);
        return {value: 0, high: 0};
      }
      assert.strictEqual(name, "sysctl");
      assert.deepStrictEqual(args, [native.frameAddress + 0x400, 4,
        native.frameAddress + 0x1000, native.frameAddress + 0x200, 0, 0]);
      if (mapReturn === 0) {
        view.setUint32(0x200, 272, true);
        for (const [index, start, end, prot] of [
          [0, 0x100000000, 0x104000000, 3],
          [1, 0x200000000, 0x208000000, 0]
        ]) {
          const at = 0x1000 + index * 136;
          view.setUint32(at, 136, true);
          view.setUint32(at + 8, start >>> 0, true);
          view.setUint32(at + 12, Math.floor(start / 4294967296), true);
          view.setUint32(at + 16, end >>> 0, true);
          view.setUint32(at + 20, Math.floor(end / 4294967296), true);
          view.setUint32(at + 56, prot, true);
        }
      }
      return {value: mapReturn, high: 0};
    },
    readErrno() {return 1;}
  };
  const page = {__fw14NativeInvoke: native,
    __fw14ArrayState: {array, a: anchor}};
  const api = {log(value) {logs.push(value);}, markSync() {}};
  const check = probe(api, page)[0];
  assert(frame.subarray(0x200, 0x9020).every(byte => byte === 0x37));
  assert.strictEqual(array[0], anchor);
  return {check, logs, calls};
}

const success = run(0);
assert.strictEqual(success.check.status, "pass");
assert.strictEqual(success.check.details.soft_bytes, 0x60000000);
assert.strictEqual(success.check.details.mapped_bytes, 192 * 1048576);
assert.strictEqual(success.check.details.unreadable_bytes, 128 * 1048576);
assert.strictEqual(success.check.details.map_count, 2);
assert.strictEqual(success.check.details.difference_mib, 1344);
assert.deepStrictEqual(success.calls,
  ["getpid", "getrlimit", "sysctl", "getpid"]);
assert.match(success.logs[0], /mapped 192 MiB/);

const denied = run(-1);
assert.strictEqual(denied.check.status, "error");
assert.strictEqual(denied.check.details.phase, "vmmap");
assert.strictEqual(denied.check.details.frame_restored, true);

console.log("Live limit and map comparison restores owned scratch");
