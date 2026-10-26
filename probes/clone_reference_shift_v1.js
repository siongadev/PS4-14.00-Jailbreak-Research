// Determine whether a BigInt shifts a repeated reference onto earlier graph nodes.
function examine(id, fillerCount, bigIntFirst) {
  try {
    var target = { marker: "target" };
    var source = [];
    if (bigIntFirst)
      source.push(BigInt(23));
    for (var index = 0; index < fillerCount; index++)
      source.push({ marker: "filler-" + index });
    var firstIndex = source.length;
    source.push(target, target);
    var clone = structuredClone(source);
    var repeated = clone[firstIndex + 1];
    var alias = clone[firstIndex] === repeated;
    var marker = repeated && repeated.marker ? String(repeated.marker) : "";
    var type = typeof repeated;
    return {
      id: id,
      status: alias && marker === "target" && clone[firstIndex] !== target ? "pass" : "fail",
      details: { alias: alias, marker: marker, repeated_type: type,
                 bigint_value: type === "bigint" ? String(repeated) : "" }
    };
  } catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

return [
  examine("zero_fillers_control", 0, false),
  examine("three_fillers_control", 3, false),
  examine("bigint_zero_fillers", 0, true),
  examine("bigint_one_filler", 1, true),
  examine("bigint_two_fillers", 2, true),
  examine("bigint_three_fillers", 3, true),
  examine("bigint_four_fillers", 4, true)
];
