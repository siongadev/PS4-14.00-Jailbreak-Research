var result;
try {
  var acc = 0;
  for (var i = 0; i < 20000; i++) acc += Math.expm1((i % 17) + 1);
  result = { id: "warm_expm1_v1", status: "pass",
    details: { sample: Math.expm1(1), finite: isFinite(acc) } };
} catch (error) {
  result = { id: "warm_expm1_v1", status: "error",
    details: { error: String(error).slice(0, 180) } };
}
return [result];
