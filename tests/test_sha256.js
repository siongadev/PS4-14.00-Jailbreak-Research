"use strict";

var assert = require("assert");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../web/sha256.js"), "utf8"), context);
var hex = context.window.FW14_SHA256.hex;

assert.strictEqual(hex(""),
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
assert.strictEqual(hex("abc"),
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

[
  "A".repeat(55),
  "A".repeat(56),
  "A".repeat(64),
  "PS4 14.00: π 漢字 😃",
  "unpaired: \ud800 end",
  "long text ".repeat(1000)
].forEach(function (sample) {
  var expected = crypto.createHash("sha256").update(sample, "utf8").digest("hex");
  assert.strictEqual(hex(sample), expected, JSON.stringify(sample.slice(0, 40)));
});

assert.throws(function () { hex(123); }, /SHA-256 input must be a string/);
console.log("SHA-256 browser helper passed 8 vectors and type validation");
