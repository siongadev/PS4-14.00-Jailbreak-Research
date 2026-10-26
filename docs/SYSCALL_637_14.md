# Syscall 637: PS4 14.00 evidence and limits

The [PS4 syscall table](https://www.psdevwiki.com/ps4/Syscalls)
calls number 637 `set_phys_fmem_limit`.
That historical name is a lead, not a verified 14.00 kernel signature.
The bounded self-target call shape `(0, 0xffffffff)` is tested below;
its return value alone supplies no before/after limit measurement,
credential change, or kernel-memory readback.

Our [verified 14.00 triad](../captures/b84fd1b67b7741dabc1dc252f4f86b82.json)
recorded a successful 637 call for one large first argument and a fixed
second argument. The [verified follow-up](../captures/1da006ae1e6548a8bac2a5fb199e5069.json)
used first argument `0x0000700000000000`: a missing or small second
argument returned `EINVAL`, while an owned buffer *address used as the
second argument's numeric value* returned zero. The buffer was unchanged.
Its neighbors with a nonzero low word returned `EINVAL`. These are the
device-observed facts; they do not demonstrate a resource change.
The earlier triad's `(0x0000700000000000, 0x1000)` succeeded while the
later follow-up's same argument pair returned `EINVAL` in that same page
session. This difference could reflect state changed by the first call;
we cannot infer a stable contract from either return alone.

The original `clone_history_sel637_v1` source called the first argument
a selector and the second an output buffer. A better *hypothesis* is that
637 interprets the low part of the first argument as target ID 0 and the
second as a minimum-sized limit; an address-shaped value would then be
accepted as a large integer, not written through as a pointer. The
original pinned source and captures remain unchanged to preserve the
record. An independent readback or matched allocation ceiling test is
needed before claiming that a 14.00 budget changed.

A return code alone cannot distinguish an effective limit change from
an inert store. A write to one designated limit field would not be
arbitrary kernel write or a sandbox escape.

The [ProcParam high-word write](PROCPARAM_MEMORY_14.md) was a separate
user-space mutation. It cannot establish the semantics or effects of
syscall 637. Prior low-value 637 calls should not be repeated casually
without a measured limit and recovery plan.

## Direct 14.00 follow-up

On the currently calibrated page, PID 72, the bounded self-target
`637(0, 0xffffffff)` returned zero. Before and after, `is_in_sandbox`
and `is_development_mode` stayed `1,0`; a one-pointer 615 call returned
`EFAULT` both times. [Verified 637 capture](../captures/433987af73804867a822837b6cc8ffb1.json).
The page remained connected. This proves reachability of that call
shape, not an effective limit change or arbitrary kernel write.

The follow-up found a useful *usage* readback. `615(pid, out1, out2)`
returned zero and wrote two eight-byte values to owned guarded outputs
([layout capture](../captures/70df06363b9b46239cad023eede6f77d.json)).
A controlled 2 MiB typed-array allocation, touched every 4 KiB, made
both low words rise by exactly 128, consistent with accounting in
16 KiB pages: first `6983 -> 7111`, second `18425 -> 18553`
([delta capture](../captures/666a1deee2ac4823b764cbdc267999e3.json)).
This is an independently responsive resident-memory oracle. Neither
output has yet been identified as the *limit* stored by 637, so these
post-637 samples still cannot establish the setter's effect.

A matched PID boundary check used the current browser PID `72`, its
freshly queried parent PID `38`, and an absent PID. The self query
returned `0` and wrote both eight-byte outputs. The parent and absent
queries each returned `EPERM` (`1`) and wrote **zero** bytes to either
sentinel-filled output; guards stayed intact. [Verified boundary
capture](../captures/0c0ce74bac51476596247fe0054ddb9e.json).
This makes 615 a useful current-process usage oracle, but it supplies
no cross-process read and no independent limit readback.

Next discriminating step: locate a 14.00 limit readback or a stable,
bounded allocation-ceiling comparison on separately calibrated pages.
Preserve and restore the original value if the interface permits. Until
then, classify 637 as a reachable, argument-sensitive resource interface
with no demonstrated sandbox boundary effect.

A candidate readback was `sceKernelAvailableFlexibleMemorySize(size_t*)`,
whose [public SDK declaration](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain/blob/master/include/orbis/libkernel.h)
has an output pointer. A [public PS4 NID mapping](https://github.com/zipzip11/ps4ida/blob/main/aerolib.csv) gives `aNz11fnnzi4` for
that name and `1G3lF1Gg1k8` for the known `sceKernelOpen` control.
The first lookup probe had an incorrect module-list argument shape and
stopped before resolution ([rejected setup capture](../captures/1304160d7e2840b98b794d577ea5b08f.json)).
The corrected probe listed the live libkernel handle `8193`, then tried
the plaintext control and both NIDs through syscall 591. All three
returned `-1`/`ESRCH` with intact guards and restored owned bytes
([verified capture](../captures/d3fba2f7f9154d9da4ea85ed5b32dd38.json)).
No export address was obtained, so no flexible-memory function was
called and 637 still has no independent limit readback.
