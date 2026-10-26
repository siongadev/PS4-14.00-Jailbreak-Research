# Completed console run: large History clone on 14.00

This was the operator run order for the two prepared probes. The first run and one fresh-page repeat were completed on October 19, 2026. The later source-guided tests advanced from that load exception to controlled value and object-reference insertion, then reproduced a self-reference absent from the input; see [the verified results](HISTORY_14_RUNS.md). Use only the new `fw14-research` page and collector; the old observer and all earlier-firmware offsets remain out of scope. The [triage](LEGACY_14_TRIAGE.md) gives the raw 14.00 provenance and prepared probe hashes.

1. Check the PS4's System Information still reads **14.00**. Open the new research page, enter `14.00`, and press **Connect for remote tests**. On the PC, from `fw14-research`, run `python -m fw14lab.control sessions` and use the recently polling session ID. Start the documented server only if it is not already running.
2. Queue only the no-BigInt control: `python -m fw14lab.control enqueue-probe --session SESSION_ID --manifest probes/clone_history_large_control_v1.json`. Use `python -m fw14lab.control commands` to obtain its command ID and capture ID. The two checks must both be `pass`, with `cleanup_ok: true`, output lengths 3 and 65536, `output_alias: true`, and `tail_ok: true`. Verify its capture with `python -m fw14lab.verify captures/CAPTURE_ID.json`. Stop if any control field differs or no result arrives.
3. Refresh the PS4 page and reconnect. Queue only `probes/clone_history_large_bigint_v1.json` in the new session. Its first check repeats the small number control; its second submits the 65,536-element BigInt graph. Record the command ID, final capture if any, and `python -m fw14lab.control markers --command-id COMMAND_ID`. Ask the operator to report any immediate warning and whether the page refreshed.

| BigInt large-case outcome | Interpretation and next step |
| --- | --- |
| `fail`, `output_length: 327681`, broken alias | Independently reproduced the old large anomaly under the new collector. Reduce filler and outer sizes in later single-case probes, then seek a fresh owned-object write proof. |
| `error` at `phase: load` with deserialization error | Matches the other old 14.00 large outcome. Repeat once on a fresh page only if the control passed; record both results. |
| `pass` with length 65536 and preserved alias | This fresh run did not reproduce the large anomaly. Park the old carrier shape; the new project's smaller clone defect remains separately confirmed. |
| Memory warning or missing result | Save marker and on-screen observations. A marker locates the last completed phase; neither outcome alone identifies a native fault. Do not auto-retry. |
| Small number control fails or cleanup fails | Stop. This run cannot distinguish the BigInt graph from a baseline or page-state problem. |

Capture source and manifest hashes must match the prepared values in the triage. The CLI snapshots the bytes when the command is queued. Inspect the stored result before any further command; neither manifest chains into another probe.
