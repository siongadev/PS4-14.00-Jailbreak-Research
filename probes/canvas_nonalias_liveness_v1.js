async function run() {
  await api.mark("before_liveness_check");
  var gc = window.__fw14NonaliasGc;
  var state = window.__fw14MultiStale;
  if (!gc || !state)
    return [{ id: "canvas_nonalias_liveness", status: "error",
      details: { error: "missing_nonalias_state" } }];
  var weakAlive = 0;
  for (var i = 0; i < gc.weak.length; i++)
    if (gc.weak[i].deref()) weakAlive++;
  var aliasAlive = 0;
  for (var j = 0; j < gc.aliases.length; j++)
    if (state.stale[gc.aliases[j]]) aliasAlive++;
  return [{ id: "canvas_nonalias_liveness", status: "pass",
    details: { released_count: gc.released.length,
      weak_alive_count: weakAlive, finalized_count: gc.events.length,
      alias_rooted_count: aliasAlive } }];
}
return run();
