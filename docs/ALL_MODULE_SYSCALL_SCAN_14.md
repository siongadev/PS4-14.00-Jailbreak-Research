# PS4 14.00 direct-syscall byte scan across all loaded modules

The reproducible [scanner](../tools/scan_all_module_syscalls.py) rehashed
the RX segment of each of the 26 modules against the complete
[14.00 manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json)
before examining its bytes. The
[full site list](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/all_module_syscall_sites.json)
records RX-relative offsets and adjacent bytes for every literal `0f 05`
pair. Those bytes alone do **not** prove an instruction boundary or a
reachable syscall.

| RX module | Literal `0f 05` pairs |
| --- | ---: |
| `libkernel_web.sprx` | 305 |
| `libSceNKWebKit.sprx` | 110 |
| `libSceNKWebKitRequirements.sprx` | 18 |
| `libSceLibcInternal.sprx` | 19 |
| `libicu.sprx` | 404 |
| `libharfbuzz.sprx` | 15 |
| `libSceLibreSsl3.sprx` | 9 |
| `libcairo.sprx` | 4 |
| `libcurl.sprx` | 2 |
| `libfreetype.sprx` | 2 |
| Remaining 16 loaded modules | 0 |

Of `libkernel_web`'s 305 pairs, **302** have the exact preceding
`mov rax, immediate32; mov r10, rcx` sequence. The existing
[libkernel catalog](LIBKERNEL_WEB_MAP_14.md) identifies 293 ordinary
fixed-number wrappers and nine other fixed-number sites. One of those
nine has a literal `syscall; ret` at RX `+0x2c89a`. The other three raw
pairs in this module do not match that preceding wrapper sequence.

None of the other 25 modules contains that canonical preceding sequence.
Their many literal pairs are consistent with instruction immediates,
displacements or data. The one non-`libkernel_web` `0f 05 c3` string is
at `libicu` RX `+0xf67688`; its surrounding bytes are a dense table of
repeated `0f 05`-like values, so this is a table match rather than a
demonstrated executable `syscall; ret` gadget. It must not be fed to a
native chain as a callable address.

This is a negative screen for an *additional canonical fixed-number
wrapper* in the browser's loaded images. It is not proof that every raw
pair outside `libkernel_web` is unreachable, nor does it inspect modules
or kernel code absent from this process. The verified native caller
continues to use live-measured `libkernel_web` entries and current-page
address checks.

The [all-module v7 archive](../evidence/2026-10-23-all-modules-v7.zip)
preserves the site JSON with the raw mappings and verified captures. Its
30,829 manifest members and SQLite state verified; SHA-256 is
`e089bc41dfce9aefef98d4dac61cbf795e60ea2c3e30443cf132db083e911f9e`.
