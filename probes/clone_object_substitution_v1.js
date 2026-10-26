// Confirm the wrong reference is exactly an earlier cloned object, not just a matching value.
function examine(id, first) {
  try {
    var filler = { marker: "filler" };
    var target = { marker: "target" };
    var clone = structuredClone([first, filler, target, target]);
    var targetAlias = clone[2] === clone[3];
    var fillerAlias = clone[1] === clone[3];
    var separate = clone[1] !== filler && clone[2] !== target;
    var marker = clone[3] && clone[3].marker;
    return {
      id: id,
      status: targetAlias && !fillerAlias && separate && marker === "target" ? "pass" : "fail",
      details: { target_alias: targetAlias, filler_alias: fillerAlias,
                 separate: separate, repeated_marker: String(marker) }
    };
  } catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

return [
  examine("number_control", 23),
  examine("bigint_shift", BigInt(23))
];
