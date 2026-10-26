# PS4 14.00 Mbus and AvSetting client gates

These results use only the complete mapped images from 14.00 browser page
`2119cf8f1a734dc5a6b964e8c2b1d3fb` (PID 74) and checked native calls
on that same page. The [manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json)
and [import graph](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/import_graph.json)
give the module identity and source of every offset. Addresses observed in
this page's heap are not valid after a refresh.

## Mbus

The original full-image snapshot of `libSceMbus.sprx` (handle 58) showed
an uninitialized client. Its 14.00 [decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/mbus_functions.txt)
identifies initializer RX `+0x32c0`, which creates a `SceMbusIpc` client,
connects it through IPMI, and sets its state to `2` on success. The
[v41 checked caller](../probes/clone_history_native_invoke_install_v41.js)
verified the initializer's 16 entry bytes on the live page. One
[initializer call](../captures/05347b3389c84643a8190841f755fc18.json)
returned `0`. A separate [corrected state read](../captures/792d47bc43004f95b7ee991f4d37b4a9.json)
measured state `2` and a client vtable in the current page's IPMI RO map.
The earlier [v1 state capture](../captures/365801484f824969b0a86e8d0d404e07.json)
used a `subarray()` after redirecting a typed-view pointer and produced an
invalid composite address; it supports no state or pointer claim.

The same 14.00 client code defines method `0xce110038` at RX `+0x2190`
with zero input descriptors and one `0xb10`-byte output descriptor. The
[v42 caller](../captures/b9fc25af68fe4f3b99efeceba2e6d1fb.json)
checked that method's entry bytes. A single
[guarded query](../captures/b58d1cc36f8d4194b506a6c6a210b64f.json)
returned `0x809b00ff` and changed all 2,832 output bytes from `0xa5` to
zero, while its 16-byte guard and caller restoration passed. This is a
live broker request with an application or transport failure status, not
useful data or an authority change. The exact cause of that status is not
resolved from the browser-side image.

## AvSetting

`libSceAvSetting.sprx` (handle 59) has a separate initializer at RX
`+0x3c0`. Its [14.00 decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/avsetting_functions.txt)
shows an event-flag wait and a `SceAvSettingIpc` connection before it sets
the RW initialization state to `2`. The [v43 caller](../captures/11a4a89ee9fc4346b3c2d380dcc37c42.json)
checked the 16-byte function entry, rechecked 137 wrappers and ten
gadgets, and passed its PID/restoration controls. One
[initializer call](../captures/041708ecb4834236a7298947a1e17614.json)
returned `0x809a00ff`; a separate
[direct-index state read](../captures/484cbb494dda460cb3b6998c65b417f4.json)
found initialization state `0`. A nonzero value remained in the client
pointer slot, but state `0` means it must not be treated as a live
connection or passed to a method. No AvSetting method was dispatched.

Neither path has changed a credential, jail state, protected resource,
foreign process, or kernel object. Mbus is connected but its first
output-only method failed; AvSetting did not initialize. Those are
different gates, and neither is a sandbox escape.

The [evidence archive](../evidence/2026-10-23-all-modules-v7.zip) includes
the raw captures, pinned probe scripts, module images and SQLite state.
Its 30,829 manifest members and database integrity verified; SHA-256 is
`e089bc41dfce9aefef98d4dac61cbf795e60ea2c3e30443cf132db083e911f9e`.
