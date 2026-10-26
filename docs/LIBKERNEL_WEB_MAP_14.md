# PS4 14.00 browser libkernel map

The browser's loaded module is **`libkernel_web.sprx`**, handle `8193`.
Neither `libkernel.sprx` nor `libkernel_sys.sprx` appears in the 26-module
inventory of browser session `2119cf8f1a734dc5a6b964e8c2b1d3fb`, PID 74.
This map uses that console's verified [full-SPRX manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json),
not offsets from an older firmware. The absolute addresses below are a
**single-page snapshot**; refresh or reboot requires a fresh module census.

| Loaded module | Handle | RX start / length | RO start / length | RW start / length |
| --- | ---: | --- | --- | --- |
| `libkernel_web.sprx` | 8193 | `0x8273b8000 / 0x54000` | `0x82740c000 / 0x4000` | `0x827410000 / 0x38000` |
| `libSceLibcInternal.sprx` | 2 | `0x830130000 / 0x134000` | `0x830264000 / 0x8000` | `0x83026c000 / 0x8000` |
| `libSceNet.sprx` | 29 | `0x83f914000 / 0x38000` | `0x83f94c000 / 0x4000` | `0x83f950000 / 0x114000` |

There is no separately named `libc.sprx` in this inventory. The two other
relevant loaded modules are `libSceLibcInternal.sprx` and
`libScePosixForWebKit.sprx` (handle 18). Their presence does not identify
specific `memcpy` or `memset` entrypoints yet. The module API's
`reported_base` for libc and Net points *inside* their data mappings; the
table uses the verified start of each executable mapping for offsets.

The captured [Sysmodule client](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/sysmodule_loader_functions.txt)
calls the number-594 module loader with `(path, 0, out_handle, 0)` and
contains a literal `/system/common/lib/libc.sprx` fallback path. A live
guarded check used that exact call shape for `libkernel.sprx` and
`/system/common/lib/libkernel.sprx`: both returned `-1/ENOENT (2)`, and
the 27-handle list did not change
([capture](../captures/bd3ce962a5d947e98891517a956d8d64.json)).
A matched `libc.sprx` / `/system/common/lib/libc.sprx` control also
returned `ENOENT` twice with no list change
([capture](../captures/73a3f7c132d04144911a8c6b881de6a1.json)).
Both calls restored their owned frames and kept PID 74. Because even the
client's literal libc path failed, these errors cannot separate an absent
file, the browser's jailed path view, and a loader policy that masks access.
They establish only that the four tested names are not a working load
route from this browser process.

## Direct syscall surface

The [reproducible byte scanner](../tools/map_libkernel_web.py) verified the
344 KiB `libkernel_web` RX image against its SHA-256 manifest entry before
enumerating **293 distinct ordinary wrappers and 293 unique fixed syscall
numbers**. Every ordinary wrapper has the form
`mov rax, immediate; mov r10, rcx; syscall; jb error; ret`. They occupy only
the three RX pages at offsets `+0x2b000`, `+0x2c000`, and `+0x2d000`, split
115/117/61. The [machine-readable catalog](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_syscalls.json)
and [number-sorted CSV](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_syscalls.csv)
record each number, stable RX offset, this session's address, and exact bytes.
The error branches converge on one helper in this captured image.

This independently reproduces the earlier live [three-page census](../captures/0d7687b41f104aada204059eb3ef9c64.json)
from a different page: comparison of the two number sets yields **zero
missing and zero extra numbers**. An earlier [full-range device census](../captures/e6f4f536831e40ca9350b2dc83045a14.json)
also found no additional ordinary wrappers outside the three pages. This is
an exact map of this **module's ordinary wrapper pattern**, not the kernel's
entire syscall table or the meaning/permission of every number.

The RX image has 305 `0F 05` byte pairs in total. Nine additional
*instruction-shaped sites* also load fixed immediates before `syscall` (numbers
42, 251, 1, 50, 421, 59, 454, 55, and 340). Three other byte pairs are
embedded in immediates/displacements rather than standalone instructions.
The [earlier live opcode capture](../captures/74bbb24ed4f447f286b8d48ce0940de8.json)
observed the same 305/9/3 breakdown in a different session.

There is exactly one literal **`syscall; ret`** (`0F 05 C3`) sequence:
`libkernel_web` RX `+0x2c89a`, address `0x8273e489a` on this page. It is
inside the special site beginning at `+0x2c890`, whose preceding bytes load
`RAX = 454`. There is also a separate ordinary number-454 wrapper at
`+0x2bab0`. This gadget is real mapped code, but **not a validated arbitrary
syscall gateway**. On 14.00, entering the correct number-20 wrapper's
interior with number 20 returned the PID; entering the identical suffix of
the number-456 wrapper with number 20 stopped and produced the familiar
memory warning and refresh ([matched evidence](SANDBOX_WRAPPER_CENSUS_14.md)).
The [primary PS4 research slides](https://www.psdevwiki.com/ps4/images/a/a9/02r0.pdf)
describe a check on opcodes preceding `syscall`: an interior site worked
only when the requested number matched that site's fixed immediate.
Sony's exact 14.00 kernel check remains unseen, but the live mismatch result
already rules out treating every `syscall` site as a free choice of number.

The public [PS4 payload SDK fallback](https://github.com/stooged/ps4-payload-sdk/blob/master/libPS4/source/kernel.c)
confirms why older payloads try `libkernel_web.sprx` when the standard
module is unavailable. It is historical implementation guidance; its
function names, exports, and assumptions do not prove 14.00 permissions.

## What this browser has actually done through the bridge

| 14.00 browser observation | What it establishes | Record |
| --- | --- | --- |
| Number 20 returned the live browser PID through a restored native-call chain on fresh pages. | The WebKit process can execute its mapped wrapper path. | [Native call](HISTORY_NATIVE_CALL_14.md) |
| UID returned `1`; named sandbox-state call returned `1`. | The caller has a sandboxed process identity; this is not privilege escalation. | [Boundary](SANDBOX_BOUNDARY_14.md) |
| Socket, connect, bind, listen, receive, routing-socket request, and event-queue operations produced measured results, including ordinary denials. | Networking and event syscalls are reachable under current browser policy. | [Unix sockets](SYSTEM_TMP_SOCKET_14.md), [routing socket](ROUTE_SOCKET_14.md), [event queue](SANDBOX_WORKER_PATH_14.md) |
| Number 454 owned mutex try-lock/lock/unlock wrote and cleared a nonzero owner word. | A concrete fixed syscall is functional, including an owned-memory effect. | [UMTX](UMTX_SHM_GATE_14.md) |
| Dynamic-module and IPC requests returned distinct success/denial values; protected file and service attempts did not yield authority. | A callable wrapper does not imply the requested operation is permitted. | [Module/dispatcher](NAMEDOBJ_14.md), [IPMI](IPMI_CLIENT_14.md), [system service](SYSTEM_SERVICE_IMAGE_14.md) |

The module's presence and the wrapper catalog establish *entrypoints*, not
kernel read/write, protected process access, or a sandbox escape. Those still
require an observable 14.00 effect across the boundary.

## Other entrypoints and network transfer

The current [live import-link graph](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/import_graph.json)
contains 858 candidate links from the 26 captured modules into 338 distinct
`libkernel_web` RX offsets. Seventy-eight of those targets are ordinary
syscall wrappers (186 links); the other targets include library helpers.
Ghidra's [function index](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_index.txt)
detected 1,476 functions, and its
[direct-call graph](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_callgraph.csv)
contains 3,710 edges. These are static analysis candidates, not a complete
export list or proof that every path can execute in the browser; indirect
calls and Sony-specific symbol metadata are not resolved.

Focused decompilation of the highest-linked helper entries gives this
*provisional* role map. These are stable RX offsets in the captured image,
not resolved Sony export names:

| RX offset | Byte/code relationship | Provisional role |
| --- | --- | --- |
| `+0x25e70` | Returns a thread-local or fallback 32-bit status pointer. | Error/status storage helper. |
| `+0x7de0` | Calls the fixed number-6 wrapper with cancellation bookkeeping. | Close-shaped helper. |
| `+0xe020` | Calls fixed number 5 and handles a variadic mode argument. | Open-shaped helper. |
| `+0x11520` | Calls fixed number 4 with a descriptor, buffer, and length. | Write-shaped helper. |
| `+0x14550` | Calls fixed number 557 after constructing state and flags. | Named-object create-shaped helper. |
| `+0x18150` | Calls fixed number 98 with descriptor, address, and length. | Connect-shaped helper. |
| `+0x29a10` | Calls fixed number 3 with descriptor, buffer, and length. | Read-shaped helper. |
| `+0x31c0` | Calls the number-598 path and checks an `ORBI` structure header. | Process-parameter reader. |

A further [high-use helper decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_top_helpers.txt)
shows that several popular import targets (`+0x12f60`, `+0x1ac20`,
`+0x22f60`, `+0x3d80`, `+0x1c160`, `+0x14300`, `+0x15270`, and
`+0x1c1f0`) are small status-code translation shims. Their code calls
another helper and subtracts `0x7ffe0000` from a nonzero result. The
frequently linked `+0xd030` executes `int 0x44` and does not return in
Ghidra's analysis. Other high-use entries implement pthread mutex
lock/unlock behavior. This is a useful warning against treating every
imported address as another syscall gateway: much of this module is
threading and error-handling machinery. These roles are inferred from
decompiled code, not verified export names or permissions.

The Ghidra [first batch](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_hot.txt)
and [second batch](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_helpers.txt)
preserve the decompiled code. Error translation and cancellation behavior
matter: calling the raw stub instead of a helper may return a different
status representation even when it enters the same kernel number.

A bounded live number-591 `dynlib_dlsym` check confirmed handle `8193` in
the fresh module list, then queried `sceKernelOpen` and two historical NID
strings. All three returned `-1/ESRCH (3)` with unchanged output guards,
PID 74, and restored browser state
([capture](../captures/d4df62e57ec54b1b89a1695c320b5ac3.json)). This
does not prove those exports are absent: the strings or namespace may be
wrong, and other resolution paths remain. It does rule out using those
three identifiers as a working 14.00 address oracle via the tested call.

`libSceNet.sprx` is loaded. Its captured image has 53 candidate links into
`libkernel_web`, including 28 ordinary syscall wrappers. Direct native TCP
has now been demonstrated through the browser's fixed syscall wrappers:
socket returned fd `9`, connect to the page's collector returned `0`, and
close returned `0` with restored browser state
([connect capture](../captures/2a03277737844e9b9d6f929ef0248805.json)).
A second control wrote an 86-byte fixed HTTP canary on a new native TCP
socket; socket, connect, write, and close all succeeded with the browser
state restored ([write capture](../captures/bfbcb2d7e19b4c12be1cc755d2d72007.json)).
These calls used `libkernel_web` syscall sites directly, not a resolved
`libSceNet` export, and the native canary has no independent server-side
receipt record. The existing authenticated bulk uploader already
sent **111,853,568 bytes** of browser module mappings to this PC in bounded
8 KiB chunks and verified every segment hash ([method](FULL_SPRX_DUMP_14.md)).
A broader browser-memory dump would need a fresh VM-map census and
per-mapping readability checks; changing the transport to raw TCP does not
expand which addresses the current process can read.

The next semantic pass should resolve the higher-level library helpers and
their exported identities, then pair selected calls with bounded live
controls. Static presence alone cannot answer whether a privileged request
is allowed on 14.00.

The [updated evidence archive](../evidence/2026-10-23-libkernel-map-complete.zip)
includes this session's raw captures and analysis artifacts. Verification
passed all 30,693 manifest entries and the SQLite integrity check; its
SHA-256 is `07219a47c653d031d84fcd89f41f4f03cca4dc367d48faccf2d20a3a146a1d9f`.
