# PS4 14.00 VideoOut device boundary

This record uses the complete, hashed browser-process capture from page
`2119cf8f1a734dc5a6b964e8c2b1d3fb` (PID 74) and guarded device calls
on that same page. It establishes an accessible read-only device path;
it does **not** show a sandbox escape.

`libSceVideoOut.sprx` is module handle 60. The [14.00 manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json)
records RX `0x8146e0000` (98,304 bytes), RO 16,384 bytes, and RW
16,384 bytes. The RX SHA-256 is
`604fb0bd68d533c929ccd17cacdec5af7663153b089335cae33679cc11f20a51`.
The [analysis-only ELF](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/videoout.elf)
was constructed from these mapped segments, not from an on-disk Sony SPRX;
[Ghidra's decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/videoout_functions.txt)
contains 304 analyzed functions.

The module's initializer at RX `+0x28f0` opens `/dev/dce` with flags `2`
and stores the descriptor at RW `+0x34`. It queries `kern.sdk_version`
and constructs its default driver. The captured RW value at `+0x34`
is **`-1`**, so that VideoOut driver path was not initialized when the
dump was taken. Client functions issue `ioctl` request `0xc0308203` with
a 48-byte outer structure and various subcommand values, and one path
issues `0xc0308207`. This establishes a real DCE protocol surface, but
the module dump contains only the userland client, not the kernel
driver's validation or authorization rules. An earlier guarded browser
open/close of `/dev/dce` succeeded; no DCE command was sent here.

A later [checked initializer](../captures/9ae6bba8fdd84db8808257825a75cd57.json)
ran on the same page using live RX entry bytes validated by the
[v44 caller](../captures/ea8230d8770e47c88253ca45c7741fe6.json).
It returned normally. The separate
[state read](../captures/241d81b47250401abe18a98dc242414d.json)
found DCE fd `9`, SDK value `0x14008001`, and a zero default-driver
pointer. The descriptor and pointer values are specific to this page.

The 14.00 client code has an output-shaped `0xc0308203` ioctl using
subcommand `10` and a 72-byte buffer. One
[source-shaped query](../captures/a0194e9ea4854cc98b1c82dd2a050ddb.json)
used the initializer's measured descriptor, zero context, and an owned
guarded output. It returned `-1` with immediate `EPERM` (`errno 1`),
changed none of the 72 output bytes, preserved the guard, closed the
descriptor with return `0`, and reset the module descriptor slot to
`-1`. This result applies to that exact zero-context request. The
browser-side image cannot distinguish a general permission rejection
from a context-specific driver check, and no DCE data was read.

The same captured module contains four simple `/dev/dipsw` getters at
RX `+0x111f0`, `+0x112d0`, `+0x113b0`, and `+0x11490`. Each opens the
node read-only, issues one output-direction `ioctl`, and closes it. The
four request numbers and client output sizes are:

| Request | Output bytes |
| --- | ---: |
| `0x40048806` | 4 |
| `0x40048807` | 4 |
| `0x40088808` | 8 |
| `0x40088809` | 8 |

The [v40 native caller](../probes/clone_history_native_invoke_install_v40.js)
derived the current `libkernel_web` RX base from the page's module map,
checked the exact number-54 `ioctl` wrapper bytes at RX `+0x2cfe0`,
rechecked 134 wrapper entries and ten gadgets, passed four PID controls,
and restored the browser's changed state
([verified capture](../captures/a96d5e2b4f18409393eb29b73e9411db.json)).

One [single-request control](../probes/clone_history_dipsw_get6_v1.js)
opened `/dev/dipsw` as fd 9, called `0x40048806`, returned `0`, and
replaced a four-byte sentinel with zero. It preserved the 12-byte
output guard, closed fd 9 with return `0`, and restored the native
caller ([verified capture](../captures/87b07d2dd0db4e78a472b6eef4572d2f.json)).
A [four-getter comparison](../probes/clone_history_dipsw_getters_v1.js)
then returned `0` for every request, with zero-filled 4/4/8/8-byte
outputs, intact guards, a successful close, and a stable PID
([verified capture](../captures/b0160dccfd864b90a90c7eb1bbf7ae25.json)).
The page was still polling after both runs. The first four-getter run
executed but its result was rejected by the collector because its
details contained nested objects; that [error capture](../captures/aaeea0b28975421e8175f032126ecd62.json)
does not support an outcome claim. The corrected run serializes the
individual request results in a flat details field.

All four reads returned ordinary zero values. These are not a changed
credential, kernel-memory read, or unauthorized protected-resource
access. DCE initialization now opens the node, but the tested
output-shaped request returned `EPERM` with no data. Neither device path
currently supplies a sandbox escape primitive. Further DCE testing
needs a distinct client context and an independent authority oracle;
brute forcing subcommands would produce ambiguous errors or crashes.

The [evidence archive](../evidence/2026-10-23-videoout-device.zip)
contains 1,802 captures, 1,435 probe snapshots, 27,483 live artifacts,
and an integrity-checked SQLite backup. All 30,721 manifest entries
verified; ZIP SHA-256 is
`6023604756d8e0f7fd66334c61fead01509483fd35883fdaf3289adf6f86ac40`.
The later initializer and DCE query are included in the
[all-module v7 archive](../evidence/2026-10-23-all-modules-v7.zip), whose
30,829 entries and SQLite state verified (SHA-256
`e089bc41dfce9aefef98d4dac61cbf795e60ea2c3e30443cf132db083e911f9e`).
