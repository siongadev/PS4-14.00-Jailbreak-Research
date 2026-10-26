// Compare Map/Set reference preservation with and without a BigInt prefix.
function check(id, operation) {
  try { return operation(); }
  catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

function mapAlias(id, withBigInt) {
  return check(id, function () {
    var shared = { x: 7 };
    var map = new Map([[shared, shared]]);
    var source = withBigInt ? [BigInt(3), shared, map] : [shared, map];
    var copy = structuredClone(source);
    var item = copy[withBigInt ? 1 : 0];
    var clonedMap = copy[withBigInt ? 2 : 1];
    var alias = clonedMap.get(item) === item;
    var size = clonedMap.size;
    return { id: id, status: alias && size === 1 ? "pass" : "fail",
             details: { alias: alias, map_size: size } };
  });
}

function setAlias(id, withBigInt) {
  return check(id, function () {
    var shared = { x: 7 };
    var set = new Set([shared]);
    var source = withBigInt ? [BigInt(3), shared, set] : [shared, set];
    var copy = structuredClone(source);
    var item = copy[withBigInt ? 1 : 0];
    var clonedSet = copy[withBigInt ? 2 : 1];
    var alias = clonedSet.has(item);
    var size = clonedSet.size;
    return { id: id, status: alias && size === 1 ? "pass" : "fail",
             details: { alias: alias, set_size: size } };
  });
}

return [
  mapAlias("map_alias_no_bigint", false),
  mapAlias("map_alias_with_bigint", true),
  setAlias("set_alias_no_bigint", false),
  setAlias("set_alias_with_bigint", true),
  check("repeated_map_no_bigint", function () {
    var source = new Map([["k", 7]]);
    var copy = structuredClone([source, source]);
    var alias = copy[0] === copy[1];
    var value = copy[1].get("k") === 7;
    return { id: "repeated_map_no_bigint", status: alias && value ? "pass" : "fail",
             details: { alias: alias, value: value } };
  }),
  check("repeated_set_no_bigint", function () {
    var source = new Set([7]);
    var copy = structuredClone([source, source]);
    var alias = copy[0] === copy[1];
    var value = copy[1].has(7);
    return { id: "repeated_set_no_bigint", status: alias && value ? "pass" : "fail",
             details: { alias: alias, value: value } };
  })
];
