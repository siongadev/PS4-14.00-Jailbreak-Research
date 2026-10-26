# PS4 firmware 14.00 research

This is the detailed collector and probe workflow carried forward from `fw14-research`. For the public repository's current status and navigation, start at [README.md](README.md) and [docs/PROGRESS.md](docs/PROGRESS.md).

This is a self-contained workspace for firmware 14.00 research, with a browser baseline, local capture collector, and command queue for repeatable checks. The leading [History deserialization finding](docs/HISTORY_14_RUNS.md) supports address-directed browser-process memory reads and reversible writes. A [current-process code read](docs/HISTORY_NATIVE_READ_14.md) verified 15 WebKit gadget signatures against live bytes, and an [owned-buffer native-call chain](docs/HISTORY_NATIVE_CALL_14.md) ran and returned on two page sessions. A rebuilt [worker-side native call](docs/SANDBOX_WORKER_PATH_14.md) returned a PID and restored its pointers. The [full browser-module capture](docs/FULL_SPRX_DUMP_14.md), [all-26-module audit](docs/ALL_LOADED_MODULES_14.md), and [libkernel_web map](docs/LIBKERNEL_WEB_MAP_14.md) provide the current 14.00 module bases, service-client paths, syscall-site offsets, and a native TCP control. The [sandbox-boundary map](docs/SANDBOX_BOUNDARY_14.md) records browser UID `1` and resource denials. A [complete live 14.00 system-service RX capture](docs/SYSTEM_SERVICE_IMAGE_14.md) now ties a successful read-only LNC status request and bounded error controls to the running browser; it has not demonstrated unauthorized action. A [complete live 14.00 IPMI RX entry](docs/IPMI_IMAGE_14.md) preserves the loaded manager code; byte-checked [client management and a raw syscall connect](docs/IPMI_CLIENT_14.md) opened a session to `SceSysCoreApp` in the browser's parent PID 38 and cleanly closed it. A later `SceLncService` method attempt returned `ESRCH` and the console stopped immediately afterward; the [incident is under investigation](docs/INCIDENT_2026-10-21_IPMI_LNC.md). The loaded `libSceSysCore` client and a five-input spawn/add-process-shaped method (`0xaa110003`, path plus a `0xc40` structure) are preserved and analyzed offline, but no spawn was called. After a full power cycle, the official first-path getter and app-info getter each returned `0x80AA000B` cleanly, blaming the earlier panic on raw marshaling; every `SceSysCoreApp2` connection attempt still warns before any method, so the app-init gate is unreachable and the spawn stays gated. No authority change or sandbox escape was demonstrated. The [progress report](docs/PROGRESS.md) separates browser execution from the remaining sandbox and kernel work.

Earlier [canvas](docs/CANVAS_REENTRY_FINDING.md), [structured-clone](docs/CLONE_INTEGRITY_FINDING.md), [TransformStream](docs/TRANSFORM_STREAM_CANDIDATE.md), and [font-loading](docs/FONT_FACE_LEAD.md) investigations remain documented. The old project is read-only evidence. Only its 14.00-observed gadget locations were used as candidates, and each was rechecked against live 14.00 code bytes before the new call; no earlier-firmware heap layout or absolute address was reused. [Gadget provenance](docs/VALIDATED_GADGETS_14.md).

The [fresh 14.00 History runs](docs/HISTORY_14_RUNS.md) establish a source-predicted object-pool deserialization error: two fresh-page runs turned an acyclic input into a cloned array containing itself at a new index. A smaller 253-entry variant produced an initial [one-byte out-of-bounds read and write](docs/HISTORY_NATIVE_OOB_14.md) through a forged `Uint8Array` over an eight-byte resizable buffer. Follow-ups established [neighboring-buffer access](docs/HISTORY_NEIGHBOR_RW_14.md), [fixed-buffer access](docs/HISTORY_FIXED_BUFFER_RW_14.md), [native-pointer substitution](docs/HISTORY_NATIVE_POINTER_RW_14.md), [JSArray storage writes](docs/HISTORY_JSARRAY_STORAGE_14.md), and [absolute address calibration](docs/HISTORY_ADDRESS_DIRECTED_RW_14.md). The later [pointer-directed code read](docs/HISTORY_NATIVE_READ_14.md) and [repeated native call](docs/HISTORY_NATIVE_CALL_14.md) are the current browser-execution evidence.

## Layout

| Path | Purpose |
| --- | --- |
| `web/` | Browser page with bounded named checks and a fixed probe runner |
| `fw14lab/` | Standard-library HTTP collector, capture validation, and command queue |
| `captures/` | One JSON record per saved browser run; records begin on first save |
| `control/` | Local SQLite state for browser sessions and commands |
| `probes/` | Versioned local probe source and manifests |
| `tests/` | Input and HTTP integration tests |
| `docs/` | Evidence rules and gates for future research |
| `evidence/` | Included mapped-SPRX capture, plus local ZIP backups of raw captures and probe snapshots |
| `references/` | Origin and hashes of public source files used as hypotheses |
| `tools/` | Bounded public-source extraction and raw-evidence archival helpers |

## Run locally

Use Python 3.11 or newer. From this directory:

```powershell
python -m fw14lab.server
```

Open `http://127.0.0.1:8765/` on the PC. To serve a console on the same trusted local network, bind the PC's LAN interface:

```powershell
python -m fw14lab.server --host 0.0.0.0 --port 8765
```

Open `http://PC-LAN-IP:8765/` on the PS4. Confirm the console's version in **Settings → System → System Information**. The page auto-connects using the fixed operator label `14.00`; that label is not a version attestation. Remote checks save captures in `captures/<capture-id>.json` on the PC.

The console's current LAN HTTP page reports an insecure context, so shared-memory timing controls are unavailable on this transport even if cross-origin isolation headers were added. The [fd-registration decision plan](docs/FD_REGISTRATION_RACE_14.md) records the native alternative.

The two checks test ordinary typed-array values and a `MessageChannel` round trip. They establish that this page, JavaScript runtime, and local collector work together. They do not test a vulnerability.

## Remote checks

Leave the PS4 page open after it auto-connects. It polls the local server every two seconds and shows the first eight characters of its session ID. The on-console log shows only output written explicitly for the screen and a plain error line if a test cannot run. Probe names, markers, check IDs, and capture IDs remain in the PC records. From a terminal on the PC, inspect active sessions and queue a named check:

```powershell
python -m fw14lab.control sessions
python -m fw14lab.control actions
python -m fw14lab.control enqueue --session SESSION_ID --action runtime_inventory_v1
python -m fw14lab.control commands
```

`runtime_inventory_v1` records whether five standard browser features are exposed. `baseline_repeat_v1` repeats the two original checks. `structured_clone_smoke_v1` checks ordinary object and ArrayBuffer copies, ArrayBuffer transfer, cycles, and function rejection with small inputs. Each completed built-in command creates a version-2 capture with its session ID, command ID, action, execution times, and SHA-256 of the exact page assets served when the command was claimed. The command queue and captures remain on this PC; there is no HTTP endpoint to enqueue a command. The session secret stays in the page's memory and is lost on refresh; the refreshed page automatically registers a new session. A claimed command is never automatically run again; if the page closes mid-command, `commands` will show it as `claimed` until investigated.

An unclaimed command can be retired with `python -m fw14lab.control cancel-queued --command-id COMMAND_ID`. Its record remains visible as `cancelled`, and the browser will skip it if that old page resumes. A claimed or completed command cannot be retired this way.

For new probes, the updated page runner can fetch a source file for a claimed command without a page refresh. Keep source and its manifest directly in `probes/`, then queue it locally:

```powershell
python -m fw14lab.control enqueue-probe --session SESSION_ID --manifest probes/clone_graph_identity_v1.json
```

The CLI snapshots exact UTF-8 source bytes and the canonical manifest under `control/probe_blobs/`, each named by SHA-256. Keep that directory with the captures when archiving evidence. The browser fetches source with its session and attempt secrets, checks the digest, and executes the trusted local source under a time-limited result contract. The server derives probe metadata from its queue and records it in a version-3 capture; the manifest digest can also be checked from the fields in that capture. Probe source is arbitrary JavaScript in this page's origin; it is **not sandboxed**. Only files deliberately placed in this PC's `probes/` directory can be enqueued, and the HTTP API cannot upload or queue them. A synchronous infinite loop or browser crash cannot be interrupted by the JavaScript timer, and a claimed command is not automatically retried. The capture hash and source hash establish the PC's submitted and served bytes, not a cryptographic attestation of the console.

For a probe whose result may never return, `api.mark("phase_name")` posts an authenticated, durable milestone and resolves only after the server stores it. `api.markSync("phase_name")` does the same from a synchronous iterator callback; the PS4 control passed. Phase names are short lowercase identifiers. Inspect them with `python -m fw14lab.control markers --command-id COMMAND_ID`. The `marker_round_trip_v1`, ordinary TransformStream, JavaScript-only short-iterator, JavaScript-only wrong-type, and synchronous iterator-marker controls passed on the console. The abnormal `transform_stream_iterator_throw_v1`, `transform_stream_short_sequence_v1`, `transform_stream_type_guard_v2`, `transform_stream_type_guard_marked_v3`, and `transform_stream_full_sequence_marked_v4` probes were each followed by an immediate system-memory warning and returned no result. The v4 markers confirm execution reached the wrong-type replacement branch, yielded the third value, and completed the three-item iterator before the warning. Do not queue these abnormal-iterator probes as routine checks. The published Sony source has a fatal vector bounds check that plausibly explains the shortened-sequence warnings, but not this full-length wrong-type sequence. These markers do not establish the native faulting instruction or a read/write primitive.

The latest completed evidence snapshot is listed in [the progress report](docs/PROGRESS.md). Archives are Git-ignored because they contain console-session data. The in-place `captures/`, `control/probe_blobs/`, and `control/state.sqlite3` remain the primary live records. Use `python tools/archive_evidence.py evidence/NEW-NAME.zip` to make another snapshot, then `python tools/verify_evidence_archive.py evidence/NEW-NAME.zip` to verify its hashes, CRC, and SQLite backup.

Use this only on a trusted local network. HTTP and a browser-supplied user agent do not authenticate a physical PS4 or firmware version. The server's asset hash identifies the files it served, not the binary running on the console. A captured check is an observation, not a vulnerability claim.

To verify a saved file after copying it, run:

```powershell
python -m fw14lab.verify captures/CAPTURE_ID.json
```

## Verify

```powershell
python -m unittest discover -s tests -v
node --check web/app.js
node --check web/probes.js
node tests/test_sha256.js
node tests/test_live_probe.js
node tests/test_runner_failures.js
node tests/test_transform_cast_discriminator.js
node tests/test_font_face_control.js
node tests/test_clone_history_large.js
node tests/test_clone_history_stale_text_reuse_v2.js
node tests/test_clone_history_element_release.js
```

Node is needed only for the optional JavaScript syntax check. Console behavior must be checked on the console; local tests cannot establish firmware behavior.

## Evidence policy

Read [evidence rules](docs/EVIDENCE_RULES.md) before treating a capture or source comparison as a claim about 14.00. The [History fixed-buffer finding](docs/HISTORY_FIXED_BUFFER_RW_14.md) records the latest cross-allocation write; the [resizable-buffer finding](docs/HISTORY_NEIGHBOR_RW_14.md) records the earlier controlled map and fresh-page repeat; the [minimal native-memory finding](docs/HISTORY_NATIVE_OOB_14.md) records its one-byte precursor. The [observation log](docs/OBSERVATIONS.md) records other console results; the [canvas native follow-up](docs/CANVAS_NATIVE_FOLLOWUP.md) documents slot reuse, cross-object pixel writes, and GC controls. The [clone-integrity finding](docs/CLONE_INTEGRITY_FINDING.md) explains the earlier wrong-reference failure, while the [TransformStream finding](docs/TRANSFORM_STREAM_CANDIDATE.md) and [font-loading lead](docs/FONT_FACE_LEAD.md) record distinct warning paths. The [research gates](docs/RESEARCH_GATES.md) describe the remaining milestones. This collector records browser observations only. Its SHA-256 covers the canonical submitted JSON, making accidental changes detectable; it does not authenticate the console or prove a kernel event.
