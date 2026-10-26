"use strict";

const assert = require("assert");
const crypto = require("crypto");
const nativeSetTimeout = global.setTimeout;
const elements = {};
const results = [];
global.__lateProbeExecutions = 0;
global.window = global;
global.addEventListener = function () {};
Object.defineProperty(global, "navigator", {
  value: { userAgent: "PlayStation 4/14.00" }, configurable: true
});
global.document = {
  getElementById: function (id) {
    if (!elements[id]) elements[id] = { value: id === "firmware" ? "14.00" : "",
                                   disabled: false, textContent: "" };
    return elements[id];
  }
};
global.setTimeout = function (callback, delay) {
  return nativeSetTimeout(callback, delay === 2000 ? 1 : delay);
};
require("../web/sha256.js");

const scripts = [
  "global.__lateProbeExecutions += 1; return [{id:'probe_check',status:'pass',details:{}}];",
  "return [{id:'probe_check',status:'pass',details:{bad:BigInt(1)}}];"
];
const commands = scripts.map(function (source, index) {
  return {
    command_id: index === 0 ? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" : "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    action: "run_probe_v1", attempt: 1, attempt_token: "attempt",
    probe_id: "runner_failure_control_v1", check_ids: ["probe_check"],
    timeout_ms: index === 0 ? 20 : 1000,
    source_sha256: crypto.createHash("sha256").update(source).digest("hex")
  };
});

class FakeXHR {
  open(method, path) { this.method = method; this.path = path; }
  setRequestHeader() {}
  getResponseHeader() { return this.sourceHash; }
  respond(status, body, sourceHash) {
    this.status = status;
    this.responseText = body;
    this.sourceHash = sourceHash;
    this.onload();
  }
  send(body) {
    if (this.path === "/api/sessions") {
      nativeSetTimeout(() => this.respond(201, JSON.stringify({
        session_id: "cccccccccccccccccccccccccccccccc", session_secret: "secret"
      })), 1);
    } else if (this.path === "/api/commands/claim") {
      if (results.length >= 2) return;
      const command = commands.shift() || null;
      nativeSetTimeout(() => this.respond(200, JSON.stringify({ command: command })), 1);
    } else if (this.path.endsWith("/probe")) {
      const index = this.path.includes("aaaaaaaa") ? 0 : 1;
      const delay = index === 0 ? 50 : 1;
      nativeSetTimeout(() => this.respond(200, scripts[index],
                                       crypto.createHash("sha256").update(scripts[index]).digest("hex")),
                       delay);
    } else if (this.path === "/api/commands/result") {
      results.push(JSON.parse(body));
      nativeSetTimeout(() => this.respond(201, JSON.stringify({
        capture_id: "dddddddddddddddddddddddddddddddd", sha256: "a".repeat(64)
      })), 1);
      if (results.length === 2) nativeSetTimeout(assertions, 70);
    } else {
      throw new Error("Unexpected request: " + this.path);
    }
  }
}
global.XMLHttpRequest = FakeXHR;
require("../web/app.js");
elements.connect.onclick();

function assertions() {
  try {
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].checks[0].id, "probe_error");
    assert.strictEqual(results[1].checks[0].id, "probe_error");
    assert.strictEqual(global.__lateProbeExecutions, 0);
    assert.strictEqual(elements["remote-log"].textContent,
                       "Test error. See capture on PC.\nTest error. See capture on PC.");
    console.log("Runner saves timeout/invalid-output errors without late execution");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

nativeSetTimeout(function () {
  console.error("Runner failure test timed out");
  process.exit(1);
}, 1000);
