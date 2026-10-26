"use strict";

const assert = require("assert");
const elements = {};
const requests = [];
let loadPage;
let scheduledConnect;

global.window = {
  addEventListener(event, handler) {
    assert.strictEqual(event, "load");
    loadPage = handler;
  }
};
Object.defineProperty(global, "navigator", {
  value: { userAgent: "PlayStation 4/14.00" }, configurable: true
});
global.document = {
  getElementById(id) {
    if (!elements[id]) elements[id] = { disabled: false, hidden: id === "connect", textContent: "" };
    return elements[id];
  }
};
global.setTimeout = function (callback, delay) {
  if (delay === 500) scheduledConnect = callback;
  else assert.strictEqual(delay, 2000);
};

class FakeXHR {
  open(method, path) {
    assert.strictEqual(method, "POST");
    this.path = path;
  }
  setRequestHeader() {}
  send(body) {
    requests.push({ path: this.path, body: JSON.parse(body) });
    this.status = this.path === "/api/sessions" ? 201 : 200;
    this.responseText = this.path === "/api/sessions"
      ? JSON.stringify({ session_id: "a".repeat(32), session_secret: "secret" })
      : JSON.stringify({ command: null });
    this.onload();
  }
}
global.XMLHttpRequest = FakeXHR;

require("../web/app.js");
assert.strictEqual(requests.length, 0);
loadPage();
assert.strictEqual(typeof scheduledConnect, "function");
scheduledConnect();

setImmediate(function () {
  try {
    assert.strictEqual(requests[0].path, "/api/sessions");
    assert.strictEqual(requests[0].body.firmware_label, "14.00");
    assert.strictEqual(requests[1].path, "/api/commands/claim");
    assert.strictEqual(elements["session-id"].textContent, "aaaaaaaa");
    assert.strictEqual(elements["remote-status"].textContent, "Connected");
    assert.strictEqual(elements["remote-log"].textContent, "No output yet.");
    assert.strictEqual(elements.connect.hidden, true);
    console.log("Page auto-connects with fixed firmware 14.00");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
});
