# Live 14.00 IPMI method packet and matched controls

The complete `libSceIpmi.sprx` RX/RO/RW mappings from the retail 14.00
browser session `2119cf8f1a734dc5a6b964e8c2b1d3fb` were wrapped as an
[analysis-only ELF](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/ipmi.elf).
Its bytes are checked against the [all-module manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json).
This is a live memory image, not Sony's original SPRX file.

The RO client vtable begins at RO+`0x10`; its `+0x58` entry points to
RX+`0xb30`. The [14.00 decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/ipmi_vtable_selected.txt)
shows that method wrapper passing the client kid, method ID, input and
output descriptor counts, descriptor pointers, result pointer, and final
word `1` to RX+`0x46c0`. The [inner wrapper](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/ipmi_core_selected.txt)
sends syscall 622 operation `0x320` with a **48-byte packet**:

The distinct vtable `+0x40` entry at RX+`0x8d0` sends the **same**
operation with final word `0`, but its [14.00 function body](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/ipmi_sync_selected.txt)
hardcodes **one input and one output descriptor** and writes back an
output-size field. Our `0x30013` status query has **zero inputs and one
output**. Substituting only the final word into that request mixes the
two wrapper shapes; it does not test a valid call to the `+0x40` entry.

| Offset | Field observed in 14.00 code |
| ---: | --- |
| `0x00` | Method ID, 32 bits |
| `0x04` | Input descriptor count, 32 bits |
| `0x08` | Output descriptor count, 32 bits |
| `0x0c` | Padding, zero in the checked calls |
| `0x10` | Input descriptor array pointer |
| `0x18` | Output descriptor array pointer |
| `0x20` | Method result pointer |
| `0x28` | Final control word, `1` for the checked synchronous wrapper |

Each output descriptor is a pointer and 64-bit length. The separate
syscall-result pointer is passed as syscall argument three; it is not the
method-result pointer in the packet. The older hand-built
[`SceLncService` request](../probes/clone_history_ipmi_lnc_status_v1.js)
used `0` at packet+`0x28`. Its failed `ESRCH` method and subsequent
console failure therefore cannot be attributed to a correctly formed
14.00 synchronous request.

Two matched live controls validated the reconstructed packet without
disconnecting either module-owned client:

| Service/client | Official wrapper | Raw `0x320` with final word `1` | Evidence |
| --- | --- | --- | --- |
| VideoCore, method `0x12340017`, four-byte output | Success, output `6` | Success, output `7`; result words `0/0` | [Verified repeat](../captures/0eb53cb974e94d6582695b2e44b71e92.json) |
| SystemService's `SceLncService`, method `0x30013`, 12-byte app status | Success, `010200600001006001000000` | Success, **identical 12 bytes**; result words `0/0` | [Verified comparison](../captures/5372d2bc6fd74be88395e6e1c72855db.json) |

In the VideoCore sequence, two earlier official calls returned outputs
`3` and `4`, and their following raw call returned `5`; the final
official/raw pair returned `6`/`7`. This output changes on each call,
so the first output `1` in the earlier test was not a stable Boolean
capability marker. Its precise meaning requires server-side evidence.
The LNC status bytes were stable across its adjacent official and raw
calls. Both controls used the current page's module map, re-read the
owned client pointer and kid, guarded their output buffers, restored
scratch and forged-view state, and passed a following PID check. The
page continued polling. [VideoCore probe](../probes/clone_history_videocore_raw_method_v4.js),
[LNC probe](../probes/clone_history_lnc_raw_status_v1.js).

A third [single-word differential](../captures/9427c9d454884212852ae68bf3a0b59e.json)
used the **same live LNC client and method**, changing only packet+`0x28`
from `1` to `0`. The official status control again succeeded with the
same 12 bytes; the raw call then took about 6.7 seconds, returned `-1`
with `errno=3` (`ESRCH`), and left the output sentinel untouched. The
probe reported restoration and posted its capture at `13:19:39.938Z`.
The collector's last heartbeat for that page was at `13:19:39.940Z`;
no later poll from that page was received. The operator was asleep and
woke to the console off, so the immediate on-screen outcome was not
observed. The later power state cannot be attributed to this probe.
The old incident's method phase also took about 6.7 seconds and ended in
`ESRCH`, so the wrong mode for this zero-input request is a strong
explanation for that **method result**. Whether it relates to the later
loss of page polling is unknown. The
old client's session state was unverified. [Differential probe](../probes/clone_history_lnc_raw_flag0_v1.js).

This result establishes a working raw synchronous method **transport**
to two already-connected services. It does not bypass server policy or
show a protected read, process launch, sandbox escape, or kernel effect.
The next method test must come from a 14.00 client callsite with exact
descriptor sizes and an independent effect check. The known LNC
launch/list routes returned `0x8094000F` through the official client;
repeating them with the equivalent raw packet alone would not establish
a new capability.

The complete 14.00 SystemService LNC client has now been indexed:
[76 method wrappers](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/lnc_request_map.json)
cover IDs `0x30000` through `0x3004b`, reproducibly parsed by
[`map_lnc_requests.py`](../tools/map_lnc_requests.py). The
[caller correlation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/lnc_request_map_annotated.json)
finds internal, source-named callers for 72 of the 76 wrappers; its
[parser](../tools/annotate_lnc_requests.py) keeps the four unmatched
wrappers unlabeled. The focused
[caller analysis](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/lnc_output_only_named.txt)
identifies output-only methods `0x30018` as `isPs2Emu` (one byte),
`0x30020` as `getAppFocusedAppStatus` (12 bytes), and `0x30030` as
`getGpuCrashFullDumpAppStatus` (`0x524` bytes). The last was
subsequently run with the corrected 24-byte output descriptor stride and
returned `0x8094000F` with no protected data. The other source-shaped
list and focused-status methods returned the same denial.
[Live run and captures](LNC_SHELLUI_REBOOT_LIST_14.md). A method name
and response size in the browser client do not imply that the service
will return data or permit the browser to read it.
The same caller map identifies `0x3003f` as `crashSyscore`; no probe
calls that method. This is a source-name correlation, not evidence that
the browser could authorize or reach such an effect.
