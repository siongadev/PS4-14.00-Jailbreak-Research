# Combining confirmed PS4 14.00 primitives

Updated 2026-10-24. All device results below came from the connected retail
PS4 reporting firmware 14.00, on page session
`14f0519bff3a4fac9106e58e64c22ebe` (WebProcess PID 66). The probes
derive their pointers and descriptors on that page, and their captures
pass `python -m fw14lab.verify`. Each combination connects the output or
live state of one confirmed operation to another; return code 0 alone is
not treated as a privilege effect.

| Combined operations | Device result | Conclusion |
| --- | --- | --- |
| Pending AIO socket read → close original numeric descriptor while a duplicate keeps its socket alive → new socketpair reuses that descriptor → write distinct bytes to new then old peers | [Corrected capture](../captures/f98993223e3f43fd8c5702d75f35b8c1.json), [probe](../probes/clone_history_aio_fd_rebind_v2.js): old read fd 9, duplicate 11, replacement read fd 9. The AIO request stayed pending after the new peer's byte and completed after the old peer's byte, returning `0x51` with one result byte. Delete, guards, and frame restoration passed. | AIO retained the original socket association in this test. Descriptor-number reuse did not redirect the in-flight read. |
| NamedObj create (`557`, kind `0x4000`) → debug init (`560`, owned handle) → debug service (`601`, request 1), with request-0 readback | [Capture](../captures/a4e38b1d586f4040899d62f999ef6c88.json), [probe](../probes/clone_history_debug_handle_chain_v2.js): handle 96; init returned 0; request 1 returned `EINVAL` both before and after; request-0 output stayed `0001000000000000`. The object was deleted and buffers restored. | This init sequence did not unlock the tested debug-service request or change its measured status. |
| Pending AIO socket read → peer write → immediate delete at the completion boundary | [64-request capture](../captures/8a018626fa6744e391abf76e2e5ee99d.json), [probe](../probes/clone_history_aio_completion_delete_brute_v1.js): all 64 immediate deletes returned per-ID `EBUSY`; each completed with the expected byte and was then deleted. [128-request delay sweep](../captures/d730de035cae4702b499efa1ccec4f70.json), [probe](../probes/clone_history_aio_completion_delete_delay_v2.js): all eight delay groups also returned `EBUSY`; no anomaly, live request, guard change, or lost buffer. | These serial schedules did not enter a premature-delete state. This is not a concurrent race audit or proof that every schedule is safe. |
| SystemService app-status read → use its first output word as the local-process ID in the source-defined kill method → status readback | [Capture](../captures/2aeadea2626346ccad4b48861fa9019d.json), [probe](../probes/clone_history_service_status_kill_chain_v1.js): live ID `0x60000201`; kill returned `0x8094000F`; the 12 status bytes stayed `010200600001006001000000` and PID stayed 66. This is the same method result as the earlier absent-ID control. | A live, source-derived ID did not make this method succeed with second argument 0. The server-side cause of the denial remains unknown. |

The [first AIO fd-reuse capture](../captures/b834deb13cef4367a0cddee4def43b52.json)
was marked `fail` by the probe because it interpreted an untouched
timeout-output sentinel as a pending state. The corrected v2 probe
explicitly polled request state and passed. The [first debug-chain
capture](../captures/0167155b43604b9ebf2395c059297094.json)
stopped at preflight because the caller did not publish the `601` wrapper
in its public map; no debug syscall ran in that attempt. The corrected
v2 probe used the caller's byte-checked internal entry.

These are useful compatibility and boundary results, but none establishes
kernel memory access, a credential change, cross-process code execution,
or a browser sandbox escape. The next candidate needs either a new
14.00-specific kernel/server contract or a measurable unauthorized effect
from an already reachable interface. Further identical serial AIO-delete
or SystemService kill requests would only repeat the measured guards.
