"use strict";

(function () {
  function typedArrayCheck() {
    try {
      var bytes = new Uint8Array(3);
      bytes[0] = 0x12;
      bytes[1] = 0x34;
      bytes[2] = 0x56;
      var actual = Array.prototype.join.call(bytes, ",");
      return {
        id: "typed_array_basic",
        status: actual === "18,52,86" ? "pass" : "fail",
        details: { actual: actual, expected: "18,52,86" }
      };
    } catch (error) {
      return { id: "typed_array_basic", status: "error", details: { error: String(error).slice(0, 512) } };
    }
  }

  function messageChannelCheck() {
    return new Promise(function (resolve) {
      if (typeof MessageChannel !== "function") {
        resolve({ id: "message_channel_basic", status: "unsupported", details: {} });
        return;
      }
      var channel;
      var timer;
      var settled = false;
      function finish(check) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (channel) {
          try { channel.port1.close(); channel.port2.close(); }
          catch (error) { /* The observation has already completed. */ }
        }
        resolve(check);
      }
      try {
        channel = new MessageChannel();
        var nonce = String(Date.now()) + ":" + String(Math.random());
        timer = setTimeout(function () {
          finish({ id: "message_channel_basic", status: "error", details: { error: "timeout" } });
        }, 3000);
        channel.port2.onmessage = function (event) {
          var value = event.data;
          var matched = !!value && value.nonce === nonce &&
            !!value.payload && value.payload.number === 7;
          finish({
            id: "message_channel_basic",
            status: matched ? "pass" : "fail",
            details: { matched: matched }
          });
        };
        channel.port1.postMessage({ nonce: nonce, payload: { number: 7 } });
      } catch (error) {
        finish({ id: "message_channel_basic", status: "error", details: { error: String(error).slice(0, 512) } });
      }
    });
  }

  function baselineChecks() {
    return messageChannelCheck().then(function (messageResult) {
      return [typedArrayCheck(), messageResult];
    });
  }

  function runtimeInventory() {
    try {
      return [{
        id: "runtime_features",
        status: "pass",
        details: {
          bigint: typeof BigInt === "function",
          webassembly: typeof WebAssembly === "object",
          shared_array_buffer: typeof SharedArrayBuffer === "function",
          structured_clone: typeof structuredClone === "function",
          cross_origin_isolated: typeof crossOriginIsolated === "boolean" && crossOriginIsolated
        }
      }];
    } catch (error) {
      return [{ id: "runtime_features", status: "error", details: { error: String(error).slice(0, 512) } }];
    }
  }

  function cloneCheck(id, operation) {
    try { return operation(); }
    catch (error) {
      return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
    }
  }

  function structuredCloneSmoke() {
    var identifiers = ["clone_plain_object", "clone_arraybuffer_copy",
                       "clone_arraybuffer_transfer", "clone_cycle", "clone_function_rejection"];
    if (typeof structuredClone !== "function") {
      return identifiers.map(function (id) {
        return { id: id, status: "unsupported", details: {} };
      });
    }
    return [
      cloneCheck("clone_plain_object", function () {
        var source = { name: "fw14", nested: { value: 7 } };
        var copy = structuredClone(source);
        source.nested.value = 99;
        var separate = copy !== source;
        var nestedSeparate = copy.nested !== source.nested;
        var value = copy.nested.value;
        return { id: "clone_plain_object", status: separate && nestedSeparate && value === 7 ? "pass" : "fail",
                 details: { separate: separate, nested_separate: nestedSeparate, copied_value: value } };
      }),
      cloneCheck("clone_arraybuffer_copy", function () {
        var source = new Uint8Array([17, 34, 51]);
        var copy = structuredClone(source.buffer);
        source[0] = 68;
        var bytes = Array.prototype.join.call(new Uint8Array(copy), ",");
        var separate = copy !== source.buffer;
        return { id: "clone_arraybuffer_copy", status: separate && bytes === "17,34,51" ? "pass" : "fail",
                 details: { separate: separate, copied_bytes: bytes } };
      }),
      cloneCheck("clone_arraybuffer_transfer", function () {
        var source = new Uint8Array([85, 102]);
        var originalBuffer = source.buffer;
        var copy = structuredClone(originalBuffer, { transfer: [originalBuffer] });
        var bytes = Array.prototype.join.call(new Uint8Array(copy), ",");
        var sourceLength = originalBuffer.byteLength;
        var separate = copy !== originalBuffer;
        return { id: "clone_arraybuffer_transfer",
                 status: separate && sourceLength === 0 && bytes === "85,102" ? "pass" : "fail",
                 details: { separate: separate, source_length: sourceLength, copied_bytes: bytes } };
      }),
      cloneCheck("clone_cycle", function () {
        var source = {};
        source.self = source;
        var copy = structuredClone(source);
        var preserved = copy !== source && copy.self === copy;
        return { id: "clone_cycle", status: preserved ? "pass" : "fail",
                 details: { preserved: preserved } };
      }),
      cloneCheck("clone_function_rejection", function () {
        var errorName = "none";
        try { structuredClone(function () {}); }
        catch (error) { errorName = String(error.name || "unknown"); }
        return { id: "clone_function_rejection", status: errorName === "DataCloneError" ? "pass" : "fail",
                 details: { error_name: errorName.slice(0, 512) } };
      })
    ];
  }

  function execute(action) {
    if (action === "runtime_inventory_v1") return Promise.resolve(runtimeInventory());
    if (action === "baseline_repeat_v1") return baselineChecks();
    if (action === "structured_clone_smoke_v1") return Promise.resolve(structuredCloneSmoke());
    return Promise.reject(new Error("Unknown action"));
  }

  window.FW14_PROBES = { baselineChecks: baselineChecks, execute: execute };
}());
