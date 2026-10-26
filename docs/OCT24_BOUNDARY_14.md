# Additional 14.00 boundary checks, 2026-10-24 UTC

The retail PS4 reported firmware 14.00. Each live result below came from
a hash-pinned probe using page-local address calibration, byte-checked
native targets, a PID control, and saved capture. A successful syscall
return is not itself a sandbox escape.

| Interface | Measured result | Evidence |
| --- | --- | --- |
| Syscall 674, historically `virtual_query_all` | Six bounded owned-buffer argument shapes all returned `-1/EINVAL`; no output byte changed. The exact 14.00 ABI remains unknown. | [Capture](../captures/1b37c6c9f258485990088b910ffe1bfc.json), [probe](../probes/clone_history_virtual_query_all_shape_v1.js) |
| Syscall 675, historically `reserve_2mb_page` | A candidate 2 MiB reservation shape returned `-1/EPERM`; its output pointer stayed untouched. The layout is a hypothesis from a public emulator, not a verified Sony contract. | [Capture](../captures/ed2a289f4c984ce3a0bb1bf76f4348c0.json), [probe](../probes/clone_history_reserve_2mb_gate_v1.js) |
| RegMgr command `0x1a` | The source-derived language key read returned value 1. Writing that same value returned syscall 0 with service status `0x800d0214`; the subsequent read remained 1. | [Capture](../captures/31142a8c441e4e85ab5db0c3a4496de9.json), [probe](../probes/clone_history_regmgr_language_idempotent_write_v2.js) |
| RegMgr command `0x1c` | The distinct write-shaped command returned the same service status `0x800d0214`; readback remained 1. | [Capture](../captures/e039c01a41db4455aa622498832d3fa9.json), [probe](../probes/clone_history_regmgr_language_write1c_v1.js) |
| SystemService local-process termination | A new caller byte-checked the 14.00 `sceSystemServiceKillLocalProcess` entry at its current mapped base plus `0x4b10`. A request naming deliberately implausible local-process ID `0x7fffff00` returned `0x8094000F`; the before/after browser PID was 63. This matches the existing denied LNC launch/list methods and shows no authorized cross-process action. | [Caller install](../captures/a6efbb28275540e8bf85987c0840bc5a.json), [request capture](../captures/2a685f8a6b6a497bb6718309b5807a8a.json), [probe](../probes/clone_history_service_kill_absent_v1.js) |

The local-process termination route's 14.00 client packet uses LNC
selector `0x30008` with a 12-byte input containing two 32-bit arguments
and one byte. The captured browser module supplies the request builder;
it does not contain the server-side authorization predicate. The absent-ID
test cannot distinguish a blanket caller denial from an ID-specific
denial, but the same error across other LNC methods weighs toward a
common permission gate. No process was terminated.

The RegMgr idempotent writes provide a separate readback: the tested
language setting did not change. The two service statuses were nonzero;
neither demonstrates a credential or sandbox-state change. Syscall 674's
`EINVAL` and 675's `EPERM` are likewise boundary observations, not
evidence of controlled kernel memory access.
