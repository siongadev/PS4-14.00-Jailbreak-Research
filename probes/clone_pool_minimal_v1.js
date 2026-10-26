// Independently inspect which structured-clone sequence positions disturb an alias.
function examine(id, placement) {
  try {
    var source = { marker: "shared-object" };
    var values;
    var first;
    var second;
    if (placement === "number_before") {
      values = [17, source, source]; first = 1; second = 2;
    } else if (placement === "bigint_before") {
      values = [BigInt(17), source, source]; first = 1; second = 2;
    } else if (placement === "bigint_after") {
      values = [source, source, BigInt(17)]; first = 0; second = 1;
    } else if (placement === "bigint_between") {
      values = [source, BigInt(17), source]; first = 0; second = 2;
    } else {
      values = [BigInt(17), BigInt(19), source, source]; first = 2; second = 3;
    }
    var clone = structuredClone(values);
    var alias = clone[first] === clone[second];
    var marker = clone[second] && clone[second].marker === "shared-object";
    var separate = clone[first] !== source;
    var type = typeof clone[second];
    return {
      id: id,
      status: alias && marker && separate && type === "object" ? "pass" : "fail",
      details: { alias: alias, marker: !!marker, separate: separate,
                 second_type: type, second_value: type === "bigint" ? String(clone[second]) : "object" }
    };
  } catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

return [
  examine("number_before_alias", "number_before"),
  examine("bigint_before_alias", "bigint_before"),
  examine("bigint_after_alias", "bigint_after"),
  examine("bigint_between_alias", "bigint_between"),
  examine("two_bigints_before_alias", "two_bigints_before")
];
