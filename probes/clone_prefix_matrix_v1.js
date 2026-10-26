// Bounded reference-identity controls across ordinary structured-clone prefixes.
function examine(id, makePrefix) {
  try {
    var shared = { marker: "reference-target" };
    var copy = structuredClone([makePrefix(), shared, shared]);
    var alias = copy[1] === copy[2];
    var marker = !!copy[2] && copy[2].marker === "reference-target";
    var separate = copy[1] !== shared;
    var secondType = typeof copy[2];
    var secondTag = Object.prototype.toString.call(copy[2]);
    return {
      id: id,
      status: alias && marker && separate ? "pass" : "fail",
      details: { alias: alias, marker: marker, separate: separate,
                 second_type: secondType, second_tag: secondTag }
    };
  } catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

return [
  examine("number_prefix", function () { return 3; }),
  examine("bigint_prefix", function () { return BigInt(3); }),
  examine("empty_map_prefix", function () { return new Map(); }),
  examine("entry_map_prefix", function () { return new Map([["k", 3]]); }),
  examine("empty_set_prefix", function () { return new Set(); }),
  examine("entry_set_prefix", function () { return new Set([3]); }),
  examine("date_prefix", function () { return new Date(0); }),
  examine("regexp_prefix", function () { return /x/g; }),
  examine("arraybuffer_prefix", function () { return new ArrayBuffer(4); }),
  examine("typedarray_prefix", function () { return new Uint8Array([1, 2]); })
];
