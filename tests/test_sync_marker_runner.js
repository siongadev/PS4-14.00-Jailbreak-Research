"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const nativeSetTimeout = global.setTimeout;
const source = fs.readFileSync(path.join(__dirname, "../probes/iterator_sync_marker_control_v1.js"), "utf8");
const sourceHash = crypto.createHash("sha256").update(source).digest("hex");
const elements = {};
const markerBodies = [];
let savedResult = null;
let servedCommand = false;

global.window = global;
global.addEventListener = function () {};
Object.defineProperty(global, "navigator", { value: { userAgent: "PlayStation 4/14.00" }, configurable: true });
global.document = {
  getElementById(id) {
    if (!elements[id]) elements[id] = { value: id === "firmware" ? "14.00" : "", disabled: false, textContent: "" };
    return elements[id];
  }
};
global.setTimeout = function (callback, delay) {
  return nativeSetTimeout(callback, delay === 2000 ? 1 : delay);
};
require("../web/sha256.js");

class FakeXHR {
  constructor() { this.headers = {}; }
  open(method, requestPath, async) {
    this.method = method;
    this.path = requestPath;
    this.async = async !== false;
  }
  setRequestHeader(name, value) { this.headers[name] = value; }
  getResponseHeader(name) { return name === "X-FW14-Source-SHA256" ? sourceHash : null; }
  respond(status, body) {
    this.status = status;
    this.responseText = body;
    if (this.onload) this.onload();
  }
  send(body) {
    if (this.path === "/api/commands/mark") {
      assert.strictEqual(this.async, false);
      assert.strictEqual(this.headers["X-FW14-Session"], "secret");
      const value = JSON.parse(body);
      markerBodies.push(value);
      this.respond(201, JSON.stringify({ phase: value.phase, received_at: "now" }));
      return;
    }
    if (this.path === "/api/sessions") {
      nativeSetTimeout(() => this.respond(201, JSON.stringify({
        session_id: "c".repeat(32), session_secret: "secret"
      })), 1);
    } else if (this.path === "/api/commands/claim") {
      const command = !servedCommand ? {
        command_id: "a".repeat(32), action: "run_probe_v1", attempt: 1,
        attempt_token: "attempt", probe_id: "iterator_sync_marker_control_v1",
        check_ids: ["iterator_sync_marker"], timeout_ms: 5000, source_sha256: sourceHash
      } : null;
      servedCommand = true;
      nativeSetTimeout(() => this.respond(200, JSON.stringify({ command })), 1);
    } else if (this.path.endsWith("/probe")) {
      nativeSetTimeout(() => this.respond(200, source), 1);
    } else if (this.path === "/api/commands/result") {
      savedResult = JSON.parse(body);
      nativeSetTimeout(() => this.respond(201, JSON.stringify({
        capture_id: "d".repeat(32), sha256: "a".repeat(64)
      })), 1);
      nativeSetTimeout(assertions, 10);
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
    assert.strictEqual(markerBodies.length, 1);
    assert.strictEqual(markerBodies[0].phase, "inside_array_iterator");
    assert.strictEqual(markerBodies[0].command_id, "a".repeat(32));
    assert.strictEqual(savedResult.checks[0].status, "pass");
    assert.strictEqual(elements["remote-log"].textContent, "No output yet.");
    console.log("Synchronous iterator marker is posted before probe result");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

nativeSetTimeout(() => {
  console.error("Synchronous marker runner test timed out");
  process.exit(1);
}, 1000);
