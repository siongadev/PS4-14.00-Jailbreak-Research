# PS4 14.00 Sysmodule loader in the browser

The browser's full module capture includes `libSceSysmodule.sprx` (handle
16) at RX `0x831910000`, size 49,152 bytes. Its [verified segment and
hash](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json)
were wrapped in an [analysis-only ELF](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/sysmodule.elf)
and [decompiled](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/sysmodule_functions.txt).
These are live mapped bytes, not Sony's signed file or its loader policy.

The entry at RX+`0x10e0` looks up a caller-supplied **module ID** in a
fixed table of `0x136` records. It returns `0x805a1000` when the ID is
absent, then resolves a listed dependency before entering the internal
loader at RX+`0x1570`. That loader formats a path from a table-owned name
under `/system/common/lib/`, `/system/priv/lib/`, corresponding `_ex`
directories, or `/app0/sce_module/`, depending on flags and process
settings. It invokes an imported `libkernel_web` load wrapper and records
the resulting handle/refcount. The caller does not supply an arbitrary
pathname through this ID entry. The module's strings for `/dev/authmgr`
and `/dev/dipsw` are leads for deeper callsite tracing, not evidence that
the browser can open or write those devices through Sysmodule.

The module also checks current process/module information during its
initializer (RX+`0x2810`) and compares specific process names before
setting loader flags. This makes the browser context relevant; code that
works for another system process cannot be assumed to pass the same
branch here. No new module load, protected file access, or authorization
change succeeded in this audit. The source review lowers the value
of a blind ID sweep: it would exercise table-listed modules and loader
policy, not directly provide arbitrary module-path control.

A later hash-checked syscall-caller trace found a repeated local helper
at RX+`0x39b0`: it queries syscall 587 for the caller's current PID and
checks bit 62 of the first capability word. Eleven Sysmodule callsites
pass a PID obtained from the same process before using that helper to
choose a setting-read branch. The live browser record's bit 62 is clear;
the parent PID's record has it set, but the Sysmodule callsites do not
substitute the parent's PID. [Measured records and static trace](AUTHINFO_BOUNDARY_14.md).
The selected fixed-key RegMgr read for the bit-62 branch was then called
directly with its 14.00 argument shape; syscall 532 returned `EPERM` and
left guarded outputs unchanged. That kernel-side denial makes a local
branch rewrite insufficient for this key. [Verified capture](../captures/13b9de0332204b99b46da7f1e22ac1c8.json).
The matched browser-side fallback key produced RegMgr status
`0x800d0203` with no value despite syscall transport returning `0`.
[Verified fallback](../captures/32cdbf24ea35438085532533ece3249b.json).

The later full 14.00 capture let us decode all `0x136` fixed-table
records from hash-verified Sysmodule RX/RO/RW mappings. There are 293
records with a resolvable name and 276 with a nonzero public ID in this
snapshot. The reproducible [decoder](../tools/map_sysmodule_table.py)
and [complete table](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/sysmodule_id_table.json)
retain the raw state/flag fields and source addresses; the list is not a
claim that each module is loadable by the browser.

`libSceUserService` is table index 27, ID `0x80000011`, and absent from
the original 26-module browser snapshot. A [byte-checked v49 native
plan](../captures/d3377972406a44699b2dba92a1a18473.json) called
the source-defined fixed-ID loader with that ID and zero optional
arguments. The [guarded before/after list](../captures/7c418873f82049708738c9a234da1683.json)
returned `0x80020002` and showed no new module handle. Both lists had
27 entries because the module-list syscall includes handle `0` for the
main executable in addition to the 26 SPRX modules; a separate
[full list capture](../captures/efb808487ea942aa920ab765b8d03df5.json)
confirmed the exact handle set. The scratch frame and PID were restored.
The [14.00 path builder](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/sysmodule_functions.txt)
selects `/system/common/lib/libSceUserService.sprx` for that table
entry in the retail system-path branch. A separate owned read-only
[`open` check](../captures/0a2bc2198b1f40d58a7cea11034256d5.json)
returned `ENOENT` with intact guards. That is consistent with the
loader's `0x80020002`, though it does not prove the loader reported the
same underlying error. This tested module does not expand the browser
image or its authority on this page.

Four separate functions at RX+`0x50f0` through `0x52f0` open
`/dev/authmgr` with flags `2` and would issue requests
`0xc0504104`, `0xc0484102`, `0xc0484101`, or `0xc04c4103` with caller
structures. The first boundary check used the same path and flags but
sent **no ioctl**. On the live 14.00 browser it returned `-1`, errno
`2` (`ENOENT`), with PID 74 and the native state restored
([verified capture](../captures/3b84f12efc3e45028c84d16d584e10bf.json),
SHA-256 `ae869c5468c0dce8f329305090edd2cef7b081a45dc982d9708cedfee3363ef7`).
This device node is unavailable in the tested browser namespace; the
ioctl contracts were not tested and cannot be inferred from this result.
