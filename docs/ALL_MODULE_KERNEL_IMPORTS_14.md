# PS4 14.00 kernel-wrapper imports in every loaded browser module

The [reproducible correlator](../tools/map_module_syscall_imports.py) matched
the complete 14.00 [import graph](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/import_graph.json)
to the hash-checked [libkernel_web wrapper catalog](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/libkernel_web_syscalls.json).
It rechecked the target RX bytes and every matched import-slot value against
the same page's manifest. The [machine-readable result](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/module_syscall_imports.json)
covers **all 26 modules** and **186 direct links** to ordinary fixed-number
wrappers. Counts are bound import slots, not observed calls. A module with
zero direct links may still reach the kernel through an imported helper.

| Module | Direct wrapper links | Fixed syscall numbers in bound slots |
| --- | ---: | --- |
| `libSceLibcInternal.sprx` | 34 | 1, 3, 4, 5, 6, 10, 12, 15, 20, 24, 47, 59, 83, 90, 92, 116, 117, 136–138, 182–183, 188–190, 192, 196, 232, 240, 327, 329, 397, 499, 532 |
| `libSceSysmodule.sprx` | 13 | 5, 6, 20, 54, 532, 587, 594–595, 605, 607, 612, 649 |
| `libScePosixForWebKit.sprx` | 2 | 188, 232 |
| `libcairo.sprx` | 2 | 33, 232 |
| `libcurl.sprx` | 14 | 10, 31–33, 97, 104–105, 116, 118, 128, 135, 188–189, 232 |
| `libfontconfig.sprx` | 0 | — |
| `libfreetype.sprx` | 3 | 73, 92, 189 |
| `libharfbuzz.sprx` | 0 | — |
| `libicu.sprx` | 1 | 116 |
| `libpng16.sprx` | 0 | — |
| `libSceIpmi.sprx` | 4 | 20, 587, 607, 622 |
| `libSceSysCore.sprx` | 0 | — |
| `libSceNet.sprx` | 28 | 3, 5–6, 27–32, 54, 98–99, 101–102, 104–106, 113–114, 118, 125, 133–134, 136, 141, 189, 362–363 |
| `libSceNetCtl.sprx` | 0 | — |
| `libSceRandom.sprx` | 1 | 54 |
| `libSceLibreSsl3.sprx` | 11 | 24, 54, 97, 104–106, 116, 118, 134, 188–189 |
| `libSceRegMgr.sprx` | 1 | 532 |
| `libSceSystemService.sprx` | 11 | 10, 20, 54, 73, 97, 104, 106, 189, 482, 587, 607 |
| `libSceMbus.sprx` | 3 | 20, 362–363 |
| `libSceAvSetting.sprx` | 4 | 73, 189, 482–483 |
| `libSceVideoOut.sprx` | 9 | 5–6, 20, 54, 73, 363, 587, 607 |
| `libSceVideoCoreServerInterface.sprx` | 4 | 73, 97, 482–483 |
| `libSceNKWebKitRequirements.sprx` | 15 | 10, 20, 25, 33, 73–74, 92, 116, 124, 136–138, 188–190 |
| `libSceNKWebKit.sprx` | 22 | 1, 20, 32–33, 41, 73–75, 97, 104–106, 117–118, 128, 135, 188–190, 232, 331, 482 |
| `libSceGLSlimClientVSH.sprx` | 4 | 20, 73, 97, 135 |
| `libkernel_web.sprx` | 0 | —; it contains the wrappers themselves |

The most interesting new source relationship is `libSceSysmodule`'s bound
number-649 wrapper. Its checked 14.00
[decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/sysmodule_functions.txt)
calls the import with `(module_handle, 8, &module_param_pointer)` twice:
once while loading a table-listed module and once while validating an
existing handle. The caller checks that the returned parameter block is
at least `0x18` bytes and reads the SDK value at offset `0x10`. That makes
649 a **module-parameter query-shaped** path in this client. A guarded
[live call](../captures/0c16bbca551e4f3c8ea930823e99ae6e.json) on
the same 14.00 browser page returned `0` for the live Sysmodule handle
and wrote pointer `0x831920000`, the start of that module's RW mapping.
A separate [header readback](../captures/8c6db343480b4c71a5a78781eaee7afd.json)
repeated the call, confirmed the pointer lies within the measured RW
segment, and read `0x18` bytes: size `0x20` and SDK value `0x14008001`
at offset `0x10`. The guarded frame and forged-view pointer were
restored, PID 74 remained live, and the page kept polling. These are
single-page addresses, not constants for another refresh. The exact
14.00 kernel-side name, other member indices, and permission checks
remain unknown. Both observed callers use handles in the browser
process. This is a local information path, not a demonstrated
cross-process primitive.

The high-interest service boundary remains through `libSceIpmi` number
622, `libSceRegMgr` number 532, and the client paths in
`libSceSystemService`, `libSceNetCtl`, `libSceMbus`, `libSceVideoOut`, and
`libSceVideoCoreServerInterface`. Their measured outcomes and limits are
in the [all-module audit](ALL_LOADED_MODULES_14.md). Neither this static
map nor the prior output-only broker checks establish a sandbox escape.

The [v9 audit archive](../evidence/2026-10-23-all-modules-v9.zip)
includes this map, both live 649 captures, their pinned probe sources,
and the full module dump. Its 30,837 members and SQLite backup verified;
SHA-256 is
`d634639274b490085e840ab7b89b87b1531f79e12d4755333ee097e8df88bec2`.
