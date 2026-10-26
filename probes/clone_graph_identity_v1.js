// Small, independent controls for structured-clone reference identity.
function check(id, operation) {
  try { return operation(); }
  catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

function aliasCase(id, prefix) {
  return check(id, function () {
    var shared = { x: 7 };
    var copy = structuredClone([prefix, shared, shared]);
    var same = copy[1] === copy[2];
    var separate = copy[1] !== shared;
    var value = copy[2] && copy[2].x === 7;
    var type = typeof copy[2];
    return {
      id: id,
      status: same && separate && value && type === "object" ? "pass" : "fail",
      details: { same: same, separate: separate, value: !!value, reference_type: type }
    };
  });
}

var checks = [
  aliasCase("identity_no_bigint", 0),
  check("bigint_primitive", function () {
    var source = BigInt(1);
    var copy = structuredClone(source);
    var equal = copy === source;
    var type = typeof copy;
    return { id: "bigint_primitive", status: equal && type === "bigint" ? "pass" : "fail",
             details: { equal: equal, cloned_type: type } };
  }),
  aliasCase("identity_with_bigint", BigInt(1)),
  check("distinct_with_bigint", function () {
    var left = { x: 7 };
    var right = { x: 9 };
    var copy = structuredClone([BigInt(1), left, right]);
    var distinct = copy[1] !== copy[2] && copy[1] !== left && copy[2] !== right;
    var values = copy[1].x === 7 && copy[2].x === 9;
    return { id: "distinct_with_bigint", status: distinct && values ? "pass" : "fail",
             details: { distinct: distinct, values: values } };
  }),
  check("cycle_with_bigint", function () {
    var source = { x: 7 };
    source.self = source;
    var copy = structuredClone([BigInt(1), source]);
    var preserved = copy[1] !== source && copy[1].self === copy[1] && copy[1].x === 7;
    return { id: "cycle_with_bigint", status: preserved ? "pass" : "fail",
             details: { preserved: preserved } };
  }),
  check("mapset_alias_with_bigint", function () {
    var shared = { x: 7 };
    var source = [BigInt(1), shared, new Map([[shared, shared]]), new Set([shared])];
    var copy = structuredClone(source);
    var mapAlias = copy[2].get(copy[1]) === copy[1];
    var setAlias = copy[3].has(copy[1]);
    return { id: "mapset_alias_with_bigint", status: mapAlias && setAlias ? "pass" : "fail",
             details: { map_alias: mapAlias, set_alias: setAlias } };
  })
];

return new Promise(function (resolve) {
  if (typeof MessageChannel !== "function") {
    checks.push({ id: "message_alias_with_bigint", status: "unsupported", details: {} });
    resolve(checks);
    return;
  }
  var channel;
  var timer;
  var settled = false;
  function finish(result) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (channel) {
      try { channel.port1.close(); channel.port2.close(); }
      catch (error) { /* The result is already settled. */ }
    }
    checks.push(result);
    resolve(checks);
  }
  try {
    channel = new MessageChannel();
    var shared = { x: 7 };
    timer = setTimeout(function () {
      finish({ id: "message_alias_with_bigint", status: "error", details: { error: "timeout" } });
    }, 3000);
    channel.port2.onmessage = function (event) {
      try {
        var copy = event.data;
        var same = copy[1] === copy[2];
        var separate = copy[1] !== shared;
        var value = copy[2] && copy[2].x === 7;
        var type = typeof copy[2];
        finish({ id: "message_alias_with_bigint",
                 status: same && separate && value && type === "object" ? "pass" : "fail",
                 details: { same: same, separate: separate, value: !!value, reference_type: type } });
      } catch (error) {
        finish({ id: "message_alias_with_bigint", status: "error",
                 details: { error: String(error).slice(0, 512) } });
      }
    };
    channel.port1.postMessage([BigInt(1), shared, shared]);
  } catch (error) {
    finish({ id: "message_alias_with_bigint", status: "error",
             details: { error: String(error).slice(0, 512) } });
  }
});
