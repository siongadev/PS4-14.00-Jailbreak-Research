# Reverse analysis of the PS4 14.00 WebProcess dump

This analysis uses only the captured **14.00** PID 68 process, session
`cae1c2f0636c4430ab13130bf6e1d974`. The source is the
[assembled manifest](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/manifest.json),
with 128 mapping files rechecked against their exact lengths and SHA-256 values.
The [structural inventory](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/structural_inventory.json)
has one row for **every one of the 142 VM mappings**. The reproducible
[inventory tool](../tools/analyze_full_process_dump.py) excludes raw heap strings
and individual pointers from its output because the dump can contain browser
page data. This is a sequential, non-atomic snapshot of one process, not a
firmware or kernel dump.

## Coverage and executable identity

| Class | Mappings | Bytes | Finding |
| --- | ---: | ---: | --- |
| Executable/readable | 28 | 107,020,288 | All complete |
| Read-only | 34 | 6,094,848 | All complete |
| Writable/readable | 66 | 54,411,264 | All complete |
| Read-permitted but uncaptured | 1 | 16,384 | The known warning-producing RW gap |
| No read permission | 13 | 134,332,416 | Not dumped |

Thus the dump contains **167,526,400 of 167,542,784 read-permitted bytes
(99.990221%)**. It does not contain the missing 16 KiB, the 13 non-readable
regions, any other process, or kernel memory. A hash comparison with the
independent 14.00 full-SPRX capture identifies all **26 loaded modules** among
the 28 RX maps. The two others are the 32 KiB `SceNKWebProcess` main image
(its RX string and process-parameter identity agree) and a 16 KiB two-stub
executable page. The [RX comparison](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/rx_comparison.json)
contains the exact cross-session hashes; the table below indexes every RX map
in this process.

| Map | RX identity | RX size |
| ---: | --- | ---: |
| 1 | `SceNKWebProcess` main | 32 KiB |
| 50 | Fixed-number 417 trampoline page | 16 KiB |
| 51 | `libSceNKWebKitRequirements.sprx` | 2,752 KiB |
| 54 | `libSceLibcInternal.sprx` | 1,232 KiB |
| 58 | `libSceLibreSsl3.sprx` | 1,664 KiB |
| 61 | `libSceSysmodule.sprx` | 48 KiB |
| 65 | `libpng16.sprx` | 240 KiB |
| 68 | `libSceRandom.sprx` | 16 KiB |
| 71 | `libSceNetCtl.sprx` | 32 KiB |
| 74 | `libSceSysCore.sprx` | 32 KiB |
| 77 | `libSceNet.sprx` | 224 KiB |
| 80 | `libSceIpmi.sprx` | 48 KiB |
| 83 | `libfontconfig.sprx` | 480 KiB |
| 86 | `libicu.sprx` | 33,280 KiB |
| 89 | `libSceAvSetting.sprx` | 48 KiB |
| 92 | `libSceRegMgr.sprx` | 16 KiB |
| 95 | `libcurl.sprx` | 800 KiB |
| 98 | `libcairo.sprx` | 1,088 KiB |
| 101 | `libharfbuzz.sprx` | 816 KiB |
| 104 | `libfreetype.sprx` | 720 KiB |
| 107 | `libSceVideoOut.sprx` | 96 KiB |
| 110 | `libkernel_web.sprx` | 336 KiB |
| 113 | `libSceMbus.sprx` | 48 KiB |
| 116 | `libSceGLSlimClientVSH.sprx` | 128 KiB |
| 119 | `libSceVideoCoreServerInterface.sprx` | 64 KiB |
| 122 | `libSceNKWebKit.sprx` | 60,000 KiB |
| 126 | `libScePosixForWebKit.sprx` | 16 KiB |
| 129 | `libSceSystemService.sprx` | 240 KiB |

No third, unidentified executable image appeared in the captured VM map. The
[full RX syscall scan](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/syscall_sites.json)
found no new canonical fixed-number wrapper outside `libkernel_web` and no
new fixed number beyond its **298 unique** fixed-number sites. The 30 numbers
reported as `sys_missing` by the page-local installer have no canonical
fixed-wrapper site in this complete executable snapshot. This is a statement
about *mapped browser code*, not a census of kernel syscalls or permissions.

The otherwise unmatched map 50 contains exactly two identical 32-byte
sequences. Each begins `call qword ptr [rsp]`, forms an argument from
`rsp+0x40`, loads `RAX=417`, executes `syscall`, then halts and loops if it
returns. Its remaining bytes are zero. This has the shape of a signal-return
trampoline: [FreeBSD's syscall table](https://cgit.freebsd.org/src/tree/sys/kern/syscalls.master)
labels 417 `sigreturn`. That name is an **inference from the upstream ABI**;
the Sony kernel implementation is absent. The bytes themselves establish that
it is a fixed-417 path, not a variable-number syscall gateway.

## Main executable and the real memory-limit path

The new [main-image import map](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/main_executable_analysis.json)
resolves **66 import stubs** from the main RX instructions through its live RO
binding slots to captured target RX mappings. The
[reproducible resolver](../tools/map_main_executable.py) verifies all three
main segments and attributes targets by the hash-matched module RX map.

| Target | Main import bindings |
| --- | ---: |
| `libSceLibcInternal.sprx` | 43 |
| `libkernel_web.sprx` | 11 |
| `libSceSysmodule.sprx`, `libSceSysCore.sprx`, `libSceNetCtl.sprx` | 2 each |
| `libScePosixForWebKit.sprx`, `libSceGLSlimClientVSH.sprx`, `libSceNet.sprx`, `libSceLibreSsl3.sprx`, `libSceSystemService.sprx`, `libSceNKWebKit.sprx` | 1 each |

The main image's seven startup keys are `WebInspectorServerPort`,
`DefaultThreadPriority`, **`FMEMSizeLimit`**, `PigletConfigType`,
`ALLOW_LOADING_ROOT_CA_FROM_FSROOT`, `LauncherId`, and `TweaksSetting`.
The [current-image disassembly](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/main_startup_disassembly.txt)
shows the actual `FMEMSizeLimit` path, relative to the main RX start:

1. In the gated startup branch, `+0x3e2c..+0x3e3d` looks up the
   `FMEMSizeLimit` key from parsed launch options. At `+0x3e62..+0x3e75`,
   a zero/missing result selects `0x600`, shifts it left by 20, and passes
   that byte value to the helper at `+0x4780`. The default expression is
   **1,536 MiB**.
2. The helper calls main import `+0x57c0`, which resolves to a fixed
   `libkernel_web` **194** wrapper, with resource selector `10` and a 16-byte
   output. It then replaces the first 64-bit word with the configured byte
   value and calls import `+0x57d0`, fixed wrapper **195**, with the same
   resource selector and pair. Failures branch to an error-log call.
3. The instruction pattern matches `getrlimit` then `setrlimit` changing the
   soft `rlim_cur` while retaining the prior `rlim_max`. [FreeBSD's syscall
   table](https://cgit.freebsd.org/src/tree/sys/kern/syscalls.master?h=release%2F13.1.0)
   assigns 194/195 those names; its
   [resource definitions](https://cgit.freebsd.org/src/tree/sys/sys/resource.h?id=f2a89e7e1d87c5a3aaa243aff3f6086e7312ecf5)
   assign selector 10 to `RLIMIT_VMEM`/`RLIMIT_AS`. The Sony 14.00 names and
   exact policy remain an upstream-ABI **inference**, while the fixed
   wrapper numbers, selector, memory operands, and branch are observed bytes.

The live follow-up now measures that limit. On a fresh, Settings-confirmed
14.00 page, the native caller checked the fixed-194 wrapper's current code
bytes and `getrlimit(10)` returned 0. Its 16-byte output was
`rlim_cur=0x0000000060000000` (**1,536 MiB**) and
`rlim_max=0x7fffffffffffffff`, which matches FreeBSD's `RLIM_INFINITY`
definition. The owned output frame was restored, and the user confirmed the
page remained responsive without a memory warning. [Verified limit capture](../captures/845a6f69eb674540a2ffdf5a23ad9e7f.json),
SHA-256 `e6a6175f6f133b90324143d5cffb1fe10e5a82b5391ea46900ce57addcce538b`;
[byte-checked caller capture](../captures/89e254ff7d0d4c58baaa6da1f38f7511.json).
This matches the startup path's default but does not by itself prove which
launch branch ran or that a `setrlimit(10)` call succeeded during startup.
As a separate baseline, the earlier PID-68 census lists 142 mappings totaling
301,875,200 bytes (**287.89 MiB**, including 128.12 MiB marked unavailable or
unreadable). That is about **18.7%** of the later page's measured 1,536 MiB
soft limit. The census and limit were taken from different browser sessions,
so this comparison does not measure headroom at the instant of any warning.
It does show that the captured ordinary page layout alone was far below the
reported virtual-memory limit. A transient allocation spike, another memory
budget, or an invalid access reported as a memory warning remains possible.
A same-page follow-up removed the cross-session uncertainty: the already
prepared PID-67 page queried resource 10 and its own VM map in one read-only
probe. The limit was again **1,536 MiB** and the 143 current mappings totaled
298,827,776 bytes (**284.98 MiB**, including 134,381,568 bytes in unreadable
regions). The arithmetic difference was **1,251.02 MiB**. The native call
returned, scratch was restored, and the capture verified. This is a snapshot
of mapped address ranges, not a measurement at a warning or a promise that
the entire difference is allocatable. [Same-page capture](../captures/25fc6bef596d4745a870192e409cb60c.json),
SHA-256 `130c99b497a728022484e40e00ef6f5c9784a4e484ba3235b82c90ab39f0da34`.
It does resolve the confusion in the earlier
[ProcParam field correction](PROCPARAM_MEMORY_14.md): the captured main RW
map at offset `+0x08` has `ORBI`, and its `+0x10` value is
`0x0000000014008001`, matching the SDK-version observation. The
`0xffffffff` write to its high word was **not** a demonstrated unlimited
memory setting. The live limit was obtained without another ProcParam
mutation.

## Writable memory and runtime structure

The 66 complete RW maps total **54.4 MB**. The largest, map 27 at
`0x201da8000`, is 34,963,456 bytes. Its 14,165,923 nonzero bytes include
515,505 aligned qwords that fall back inside that same captured map,
15,860 that fall in the WebKit RO map 123, and 15,743 in WebKit RX map 122.
Map 21 is 6,340,608 bytes with 44,918 self-referential qwords and 9,279
into WebKit RX. These counts suggest object/allocator-rich browser storage,
but an in-range qword is only a **pointer candidate**. The sequential
capture cannot prove those objects were simultaneously live or identify a
particular JavaScript object. The inventory records equivalent statistics
for every other captured mapping; no heap contents were published in the
report.

The WebKit RO map 123 itself contains 223,595 aligned qwords into WebKit RX,
consistent with substantial code-dispatch tables. Those entries are in a
read-only mapping; their existence is not a writable control-flow primitive.
The current code-reuse primitive remains the separately tested History
chain, not something newly proven by pointer counting in this dump.

Maps 28–49 have eleven 16 KiB no-read regions, each immediately followed
by writable storage: ten 64 KiB mappings and one 2 MiB mapping. The repeated
guard-plus-RW geometry is consistent with thread-stack allocations. The VM
map alone does not identify individual threads or their registers. The
134,135,808-byte no-read span at map 141 likewise cannot be interpreted as
committed memory merely because it occupies address space.

## What this changes and what it cannot show

This reverse pass adds the main executable, its complete 66-entry import
surface, a specific startup virtual-memory-limit path, the extra 417
trampoline interpretation, and a verified structural inventory of **all**
maps. The previously archived
[all-module audit](ALL_LOADED_MODULES_14.md) covers the 26 hash-matched SPRX
images, including service clients and WebKit, and remains the source for
their function-level findings. This report does **not** claim exhaustive
decompilation of 107 MB of executable code or a kernel image hidden inside
the browser dump.

The fresh-page `getrlimit(10)` measurement is recorded above. It confirms
the live 1,536 MiB soft limit and narrows the memory-warning analysis, but
it does not identify the warning's exact trigger or establish a sandbox
escape or kernel read/write.
