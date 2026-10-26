# PS4 14.00 browser NetCtl client boundary

This record uses only the browser's complete, hashed 14.00 module capture
and guarded calls on the same connected page session
`2119cf8f1a734dc5a6b964e8c2b1d3fb`, PID 74. It establishes a
read-only broker path; it does not establish a sandbox escape.

`libSceNetCtl.sprx` is loaded as handle 44. Its executable mapping starts
at `0x833a40000` and spans `0x8000` bytes on this page
([manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json)).
The [analysis-only ELF](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/netctl.elf)
was built from the verified RX/RO/RW mappings, not a Sony on-disk SPRX.
Ghidra's [decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/netctl_functions.txt)
found 49 distinct `0x20000`–`0x20031` IPMI method IDs in 148 analyzed
functions. These are client-code observations; the privileged server
implementation is not in the dump.

The 49 client dispatch shapes divide by **input/output descriptor counts**
(not byte counts): 16 have 0/0, seven have 0/1, five have 1/0, thirteen
have 1/1, two have 1/2, one has 1/3, one has 2/0, two have 2/3, and two
have 4/0. Method `0x20004` is one of the seven output-only shapes. The
other six output-only IDs are `0x20006`, `0x20007`, `0x20008`, `0x20009`,
`0x20017`, and `0x2002d`; their client output sizes are 56, 4, 4, 4, 4,
and 28 bytes respectively. A descriptor count or successful transport
alone does not identify a protected result.
The live [import graph](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/import_graph.json)
shows only one inbound NetCtl thunk from the loaded browser modules:
`libSceNKWebKitRequirements` RX+`0x5c8` targets NetCtl RX+`0x3200`,
the already-tested method `0x20004` client. Other NetCtl methods exist in
the loaded library, but no current-browser consumer is established by
this graph.

The captured module RW byte at RX-relative `+0xc070` is `1`, and its
client pointer at `+0xc068` points into the module's RW mapping. The
client initialization at RX `+0x1a10` constructs a client named
`SceNetCtl`, connects it, invokes method `0x20000`, and sets that byte
to `1`. The client-facing function at RX `+0x3200` checks the state and
its output pointer. It then calls the client helper at `+0x360`, which
invokes method **`0x20004` with zero input buffers and one four-byte
output**. The code shape is read-only; the method's Sony export name
and full server contract are not resolved.

The v39 [native installer](../probes/clone_history_native_invoke_install_v39.js)
derived NetCtl's current RX base from the page's own module/VM census,
checked the exact 16 entry bytes, rechecked its native gadgets and
wrappers, passed four PID controls, and restored its pointer changes
([verified capture](../captures/90ddd953e4c34ba3bdf366d04901cfc6.json)).
The [output-only call](../probes/clone_history_netctl_output4_v1.js)
returned `0` and changed an owned four-byte sentinel from `0xa5a5a5a5`
to **`3`**. Twelve guard bytes, the browser PID, and the native caller
were unchanged/restored
([verified capture](../captures/6748668b68f44083989b26f7db81d2e4.json)).
A matched [null-output control](../probes/clone_history_netctl_null_v1.js)
returned `0x80412107` and left the owned sentinel untouched, again
restoring state
([verified capture](../captures/94ec47d20e004367a4c00f1ccc4132e2.json)).
The page continued polling after both calls.

The remaining six output-only client methods were then byte-checked on
the same page. The [v45](../captures/6e21600da9cd4a75865cf57b488b89c9.json)
and [v46](../captures/f3c7c38411834ceeb199b09eb4de4ebb.json)
installers checked their live function entries and restored the native
caller. Methods `0x20006` and `0x2002d`
([capture](../captures/93dc36b8cfe0405ba20b0037c03026d3.json))
each returned `0x804121a1` and zeroed all 56 or 28 output bytes. The
other four, `0x20007`, `0x20008`, `0x20009`, and `0x20017`
([capture](../captures/33aba59c991a4f5c8f077f798d8a137a.json)),
returned the same status and each zeroed its four output bytes. Every
output guard, PID check and caller restoration passed. The source
identifies these as zero-input/output-only client shapes, but the
browser-side dump does not explain the shared server status. No useful
data or independent authority effect was observed in these six calls.

The value `3` is consistent with the public NetCtl connected-state
convention, but that label is an inference; the live evidence proves
only the four-byte result through this client path. It is not a
credential, foreign-process memory, protected file, or launch result.
The next useful NetCtl experiment would require the exact 14.00
contract of a method that could cross the browser's authority boundary
and an independent effect oracle. Repeating this seven-method
output-only family would only restate its current results.

The [evidence archive](../evidence/2026-10-23-netctl-boundary.zip)
contains the raw captures, probe snapshots, and analysis artifacts. Its
30,706 manifest entries and SQLite backup verified; SHA-256 is
`958a5de558bf6d5882520ddffbe6e3e4fbc17609714b92d3b4c135a2426a3259`.
The six later method calls are included in the
[all-module v7 archive](../evidence/2026-10-23-all-modules-v7.zip), whose
30,829 entries and SQLite state verified (SHA-256
`e089bc41dfce9aefef98d4dac61cbf795e60ea2c3e30443cf132db083e911f9e`).
