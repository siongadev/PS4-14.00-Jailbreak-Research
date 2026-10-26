# Live 14.00 IPMI module code image

Updated 2026-10-20. These observations come from the same connected retail PS4 reporting firmware 14.00, session `70f88a40719c4399a366ad3e30265d84`, and browser PID `145`. They identify one loaded module's RX mapping and recover its bytes. They do **not** establish that any IPMI interface is reachable, authorized, or useful for a sandbox escape.

## Attribution

The [module inventory](LIVE_MODULE_INVENTORY_14.md) named handle `27` `libSceIpmi.sprx`. A guarded info-ex query returned the same name and ID in [capture `c6e66a91c7a24bbba5e9db7e640cf391`](../captures/c6e66a91c7a24bbba5e9db7e640cf391.json). Its 424 raw bytes are [preserved](../evidence/live/ipmi_info_ex_14.00.bin), SHA-256 `902bd6acb26d8f1a3e04ea0620e0a0633d0601539d740231368bf21510a9681f`; [decoded record](../evidence/live/ipmi_info_ex_14.00.json). The returned size and segment-count fields are zero, so historical ABI field labels are not assumed. The word at offset `0x110` equals the mapping start `0x833f00000` below.

The independently measured [VM map](../captures/1b3e6247f3244ccbb89fb00c8b6d457d.json) contains the entry `0x833f00000-0x833f0c000/5/9`, i.e. a `0xc000`-byte executable region.

## Recovery

A [64-byte sample](../captures/0f49092e656a4575a162b43929c5e8e8.json) at the mapping start returned a function prologue with PID `145` before and after and restored the changed typed-array pointer. The complete mapping was then recovered through **22 distinct, bounded, hash-pinned browser reads**, each covering `0x900` bytes in two checks. Each part checked the measured session identity, read through the forged view, and restored the carrier pointer, its canary bytes, and ordinary `Math.expm1` behavior. The first and final part captures are [`cf53ccfc8f2b409a87b5d07d52f530a2`](../captures/cf53ccfc8f2b409a87b5d07d52f530a2.json) and [`353036a6c34b483e8e23cef50a754925`](../captures/353036a6c34b483e8e23cef50a754925.json).

The [raw image](../evidence/live/rx_0x833f00000_14.00.bin) has SHA-256 `6c6fcaf9c2bf7def0a18db20d33ac2cb0c75eef979138a2577654f3e5dda94a4`. The [sidecar](../evidence/live/rx_0x833f00000_14.00.json) lists every capture ID and the independent sample. The [collector](../tools/collect_ipmi_map.py) checked source digests, offsets, non-overlap, exact coverage, the mapping prefix, and the 64-byte sample before writing the artifact. All 22 captures pass `python -m fw14lab.verify`.

## Content observed in the image

The captured bytes start with `55 48 89 e5 41 57 41 56` (`push rbp; mov rbp,rsp; push r15; push r14`). The image contains no ELF or SELF magic. It holds code, readable strings, and exception-handling structures; the final fully zero page begins at relative offset `0xb000`, and the last nonzero byte is at `0xa483`. That layout is consistent with one RX segment of a larger module, not a complete executable.

Strings from relative offset `0x7228` identify the IPMI client/server manager implementation, including:

* `sceIpmiMgrCreateClient`, `sceIpmiMgrDestroyClient`, `sceIpmiMgrCreateServer`, `sceIpmiMgrDestroyServer`, `sceIpmiMgrCreateSession`, `sceIpmiMgrDestroySession`, `sceIpmiMgrReceivePacket`, `sceIpmiMgrSendConnectRes`, `sceIpmiMgrSendDisconnectRes`, `sceIpmiMgrCompleteAsyncMethodDispatch`, `sceIpmiMgrGetClientUserData`, `sceIpmiMgrGetSessionPidByClientKid`, `sceIpmiMgrGetClientProcTypeBySessionKid`.
* Server configuration names `SceSysCoreApp`, `SceSysCoreApp2`, `SceVshctl`, `SceInternalTestMtServer`, `SceSaveData`, and `SceIpmiTempBufferForSaveData`, plus the format `SceIpmi%02d_%s`.
* Session configuration and error strings covering client PID, outstanding-request limits, buffer-size limits, event flags, message queues, buffer-overrun detection, and invalid argument sizes.

There are 42 `ff 25` import thunks whose targets lie in the next mapping; that read-only table and its imported addresses are described below.

These strings are direct byte observations. Their names suggest the module's API surface, but a string does not prove an export address, call convention, argument layout, or reachability from the browser.

## Adjacent mappings

The same [VM-map range probe](../captures/25a0723e373548e195b4102f5ffe0f3f.json) measured the entries around the module:

| Range | Protection | Role |
| --- | --- | --- |
| `0x833f00000-0x833f0c000` | `5` (RX) | recovered code image above |
| `0x833f0c000-0x833f10000` | `1` (read-only) | GOT, vtable tables, import targets |
| `0x833f10000-0x833f24000` | `3` (read/write) | module data/bss; recovered, almost all zero |

The 16,384-byte read-only mapping was recovered through 8 bounded, restored reads and is preserved as [the raw table](../evidence/live/ro_0x833f0c000_14.00.bin), SHA-256 `345b9a0bdce6c36cd4b2fce2281ae97165a1e1dcdf900e88914c2b33ec0a98f5`; the [collector](../tools/collect_ipmi_ro_map.py) and [sidecar](../evidence/live/ro_0x833f0c000_14.00.json) record its capture IDs and the matching sample. The mapping contains no strings and no ELF header. Its first table starts with 16 zero bytes followed by 20 code pointers, including `0x833f00630` (destroy), `0x833f00710` (connect), `0x833f008d0` (sync method), and `0x833f00cd0` (async method); a larger table at offset `0x2b8` holds session/server methods. Later entries are GOT slots: the 42 `ff 25` thunks point at `0x833f0c3e0` onward, whose values are addresses in other loaded modules. The read-only table therefore identifies vtable slots and import targets but not exported symbol names.

The 81,920-byte read/write mapping was recovered through 36 bounded, restored reads and is preserved as [the raw data image](../evidence/live/rw_0x833f10000_14.00.bin), SHA-256 `33a47b16c014ebe800596686add5c83d17effe012db41f9740dbaff0cd040dd4`; [collector](../tools/collect_ipmi_rw_map.py), [sidecar](../evidence/live/rw_0x833f10000_14.00.json), and matching 64-byte sample. It contains no strings and almost no initialized data: a small runtime structure in the first `0x30` bytes (including a self-pointer at `0x20`) followed by zeros. This module therefore held no initialized global IPMI client, server, or session state in this process at capture time; the client objects in the separate record were created by the probes themselves.

The first two recovered API calls are recorded separately: [IPMI client and name interface](IPMI_CLIENT_14.md).
The later [14.00 method-packet calibration](IPMI_RAW_METHOD_ABI_14.md)
resolves the client vtable base as RO+`0x10`: vtable `+0x58` reaches
RX+`0xb30`, the explicit descriptor-array method wrapper whose packet
ends in word `1`. Vtable `+0x40` reaches RX+`0x8d0`, a separate
one-input/one-output wrapper whose packet ends in word `0`. The
original shorthand above that called `0x8d0` simply the sync method
does not describe these two distinct signatures.

## Limits and next gate

The image is the complete `0x833f00000-0x833f0c000` VM entry, not a complete module and not a shipped Sony binary. No export table, symbol table, or decrypted on-disk module was compared. No IPMI function was called from this image record itself; the separate [client record](IPMI_CLIENT_14.md) documents byte-checked create, destroy, and name queries, with no server connection, session, or boundary effect. The presence of manager strings means the library is loaded; it does not show that the browser is permitted to create a server or use a privileged service, or that a created endpoint would cross a sandbox boundary.

A later IPMI experiment advances only if it (1) locates and byte-checks a live function entry in this image, (2) uses a benign, bounded call with owned buffers and a matched ordinary control, and (3) reads back an independent effect that cannot be explained by the browser's ordinary local behavior. Creation and destruction entrypoints are side-effecting and should not be called speculatively. Until such a gate exists, this image is a baseline for identifying the 14.00 code that handles IPMI, not evidence of access.
