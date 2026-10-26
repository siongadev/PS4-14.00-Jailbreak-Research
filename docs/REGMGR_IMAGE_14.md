# Live 14.00 RegMgr image and permission gate

On browser PID 74, module-info-ex for handle 48 identified
`libSceRegMgr.sprx` at `0x80b274000`. The current process VM map placed
RX at `0x80b274000–0x80b278000`, RO at
`0x80b278000–0x80b27c000`, and RW at
`0x80b27c000–0x80b280000`. Those addresses are specific to that page.

Eight verified, pointer-restoring reads preserved the complete 16 KiB RX
mapping ([binary](../evidence/live/rx_0x80b274000_14.00.bin), SHA-256
`77ffffe9343095ebb8fe9a45ab75e3021efbefb81302b88ec2239bbd4d360b6b`).
Eight further reads preserved the complete 16 KiB RO mapping
([binary](../evidence/live/ro_0x80b278000_14.00.bin), SHA-256
`035096d48e80a56d28cafcad1a22e392aee8417b41072b79e2a0ab5df425a805`).
The first eight RO bytes are zero; the initial dump probe rejected that
valid possibility and supplied no bytes. The corrected v2 probe and
collector accepted the zero prefix and checked all chunk coverage.
The RX/RO mappings are live, relocated memory images, not the original
signed SPRX container. The later [full loaded-module capture](FULL_SPRX_DUMP_14.md)
also preserved the complete RW mapping and independently rehashed all
three RegMgr segments.

In the live RX image, the function at RX+`0x140` calls an imported
wrapper with command `0`, two zero arguments, an output-word pointer,
and two further zero arguments. The observed wrapper corresponds to
syscall 532 (`regmgr_call`). Reproducing that read-shaped call with an
owned, guarded output returned `-1` with immediate errno `1` (`EPERM`)
on this 14.00 browser. The output remained `a5a5a5a5`, its following
guard was unchanged, and the page PID and native state restored.
[Verified result](../captures/8fc4fda39f7e405e9ef78e3c24141256.json),
SHA-256 `ebf9d776b4708e373b6126a1eeccfcd67339033d85df1a2c38b165d244f46688`.
The first version ran the call but returned an array detail rejected by
the collector, so only the corrected version supplies a numeric result.

This is a 14.00 permission denial for this exact command shape. A later
source-matched command gives a more precise picture of the gate.

`libScePosixForWebKit.sprx` uses the RegMgr keyed-read wrapper at RegMgr
RX+`0x14a0` for its `SYSTEM_LANGUAGE` path. Its fixed key is
`0x12356328ecf5617b`, selector `0`. The RegMgr wrapper sends syscall
532 command `0x19` with a 16-byte key record and receives a four-byte
status and four-byte value. The guarded 14.00 test returned syscall `0`,
status `0`, and changed the value word from `0` to `1`; the page reported
`navigator.language` as `en-US`. Its output guards, PID control and native
state restoration passed ([verified capture](../captures/40d1f3ffac324facb7c7911108b33e8c.json),
SHA-256 `a371362d45310a6b9f6b303e30314737f97ff3bb00a81947bd980c092d97452a`).
Thus the earlier command-0 denial does not mean RegMgr is wholly blocked:
the browser can read at least this ordinary language setting.

The captured `libSceSystemService` image has six imports into RegMgr.
Focused [callsite decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/system_service_regmgr_selected.txt)
shows fixed-key setting reads and clock-related paths; the actual RegMgr
library has separate keyed read (`0x19`) and data read/write (`0x1a`–`0x1d`)
wrappers. This is client-side evidence of a richer interface, not proof
that a browser-originated write is permitted. No RegMgr write, credential
change, jail-state change, or sandbox escape has been observed.

`libSceNKWebKitRequirements.sprx` has two callsites for the same keyed-read
wrapper. Its [decompiled callsites](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/requirements_regmgr_selected.txt)
use key `0x6b336df7b046cf43` to select root-certificate loading and key
`0x4fbe69bd2982e2ac` as a Boolean browser check. A guarded read of each
key returned syscall `0`, but the separate RegMgr **status word** was
`0x800d0203` and the value word remained zero. The RegMgr wrapper would
therefore treat both as failed reads; syscall transport success alone is
not registry success. PID and memory guards passed, and state restored
([verified capture](../captures/a94be20b08bc47a8b9416a052030d3ef.json),
SHA-256 `1d2f9e882e49a367da2a7a6f908a59e839fb4666913de1aa705700a93201156f`).
The root-certificate branch uses its default path when that read fails.
The meaning of the second Boolean check and of status `0x800d0203`
requires more evidence; neither is a sandbox-crossing result.
