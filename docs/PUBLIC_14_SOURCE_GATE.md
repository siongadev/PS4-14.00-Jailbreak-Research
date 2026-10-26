# Public 14.00 source gate

This is a source check, not evidence from the retail console. It keeps
public code labeled “14.00” from being treated as a completed browser-to-
kernel chain without a device result.

The [public `jordy_stage2_1400.js`](https://github.com/adri22235/ps4-suid-scanner/blob/main/jordy_stage2_1400.js)
declares a 14.00 stage and gadget/offset constants, but its own code marks
the `jmp rsi` gadget unverified, returns `0` from the WebKit-vtable and
libkernel-GOT base resolvers, leaves ROP arguments and the execution pivot
as TODOs, and describes the kernel patch sequence as a plan after kernel
read/write. Its [repository README](https://github.com/adri22235/ps4-suid-scanner/blob/main/README.md)
explicitly says a kernel exploit for 14.00 is still needed and that its
14.00 page runs an analysis mode. The 13.04-derived claims in this source
are not imported into this project's 14.00 evidence or probes.

The upstream [Al-Azif `1400.c`](https://github.com/Al-Azif/ps4-exploit-kpatches/blob/main/1400.c)
is a **kernel patch payload**. Its `kpatch` entry derives `kbase` from a
kernel MSR and writes kernel instructions after that entry is executing.
It offers potential post-exploitation offsets, not a userland path to
enter the kernel. We have not read the console's 14.00 kernel bytes or
verified those offsets against it, so this file supplies no current
kernel read/write or sandbox-escape claim.

The current project instead requires a captured effect on this 14.00
console: a changed credential, an independently readable protected
resource, a server method with unauthorized output, or controlled kernel
memory read/write. None of the public files above supplies that effect.
