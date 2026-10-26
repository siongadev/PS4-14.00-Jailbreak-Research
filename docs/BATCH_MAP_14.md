# Batch-map and memory-query checks on retail PS4 14.00

The public OpenOrbis header declares
[`sceKernelBatchMap(void*, int, int*)`](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain/blob/master/include/orbis/libkernel.h)
and `sceKernelQueryMemoryProtection(void*, void**, void**, int32_t*)`.
Those signatures guided process-owned-buffer tests, but they do not
prove the exact 14.00 syscall ABI or the batch-record layout.

The byte-checked number-548 wrapper returned `-1/EINVAL` for one zeroed
record with count one. Its input, output sentinel, and guard were
unchanged ([capture](../captures/9aef4e653ae846a8b0449f09f684b4e5.json)).
Two four-value sweeps varied the first 32-bit word of that record from
0 through 7. Every call returned `-1/EINVAL`, with no output write and
intact guard ([0–3](../captures/da5df831963d487f8131f6a4d14a7dd1.json),
[4–7](../captures/2fe30bd5f18543d5b619c7e23cc8095a.json)).
The first word may not be an operation code at all. These calls give no
evidence of a VM operation or permission change.

The [shadPS4 emulator's published record layout](https://github.com/shadps4-emu/shadPS4/blob/main/src/core/libraries/kernel/memory.h)
places `operation` at byte 28 of a 32-byte entry, rather than byte 0.
This is a hypothesis for Sony 14.00, not proof of its ABI. A corrected
one-entry control first allocated an owned, 16 KiB read-only anonymous
mapping with the live number-477 wrapper. It placed that returned
address at byte 0, length `0x4000` at byte 16, protection `1` at byte
24, and operation `2` (reapply read-only protection) at byte 28.
Number 548 returned `-1/EINVAL`, changed neither the entry nor the
guarded processed-count sentinel, and the owned mapping was unmapped
successfully. [Verified capture](../captures/02499c9a61ff467bb29339e3817c44de.json).
An initial version performed the same call but returned an array in a
collector detail field; its result was rejected and supplies no numeric
evidence ([rejected capture](../captures/fc0f1bb1dc36412593932050e009f7b9.json)).
A zero-entry control returned `0` with no output write and intact guard
([verified capture](../captures/e6ca3000083f4f0581eb619ed17c9925.json)).
The count discriminator confirms the entry is considered, but the
published record layout and simple protection operation did not yield
a 14.00 VM action. Do not treat the earlier byte-zero sweep as an
operation sweep or the zero-entry return as a successful mapping.

A separate number-547 check passed an address inside the current
calibrated native frame and three owned output pointers. It returned
`-1/EINVAL` and left all 20 output bytes unchanged. A null-address
control had the same result; guards and PID held
([capture](../captures/8b7e78f7d8704e8e922e594123f4927c.json)).
The first tested address was not page-aligned. A separately pinned
repeat queried the current frame's 4 KiB- and 16 KiB-aligned addresses;
both again returned `-1/EINVAL` with unchanged outputs and guards
([capture](../captures/ac192c330a8148259eaf5bad490075e6.json)).
That closes simple alignment as the sole reason for the result, but
does not establish the syscall's 14.00 ABI. Further VM tests need a
verified input discriminator rather than more unstructured guesses.
