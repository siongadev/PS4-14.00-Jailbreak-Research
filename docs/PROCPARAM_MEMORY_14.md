# ProcParam SDK-version field correction on PS4 14.00

**Correction (2026-10-24):** The earlier label “memory-field” for root
`+0x10/+0x14` was wrong. A fresh, read-only
[14.00 capture](../captures/2ff1cec730dc4f758f8f49c8ab1d930a.json)
measured a 0x60-byte root with `ORBI` magic, entry count 5, low word
`0x14008001` at `+0x10`, high word zero at `+0x14`, and a plausible
pointer at `+0x18`. This matches the
[OpenOrbis process-parameter layout](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain/wiki/PS4-ELF-Specification),
which places the SDK version at `+0x10`, and our independent 14.00
[module-parameter query](ALL_MODULE_KERNEL_IMPORTS_14.md) reported SDK
`0x14008001`. The high word is the upper half or padding associated
with that slot in public layouts. The exact Sony 14.00 struct definition
remains unavailable, but these two 14.00 values and the layout make a
memory-limit interpretation untenable. Changing `+0x14` to
`0xffffffff` did **not** demonstrate a kernel memory-budget change.

The historical observations below are preserved as measurements, with
the former field name withdrawn.

The browser's syscall-598 ProcParam root has `ORBI` magic and a field at
`+0x10` whose original eight bytes were `01 80 00 14 00 00 00 00` in
the [max-value capture](../captures/61ae5a6a8fed4b8485a3ccc71260b4aa.json).
The pinned `clone_history_fmem_max_v1` source kept the low four bytes and
wrote `ff ff ff ff` to the **high** four bytes at `+0x14`. It then read
back `01 80 00 14 ff ff ff ff`, committed eight 1 MiB allocations, and
observed unchanged values from the sampled sandbox/development oracles.
The probe left this page-local mutation in place.

The capture's `still_max: 0` is a reporting bug: the script checked the
low four bytes at `+0x10` for `0xffffffff`, although it wrote the high
four bytes at `+0x14`. The captured `current10` bytes are the reliable
readback. The probe source and its hash are preserved as run; a future
revision must use a new probe ID and compare the high word.

The [earlier ceiling attempt](../captures/45768fbea97d4a318c7a0b82e8023c7c.json)
failed preflight with `held_plan_missing`; it did not test a larger
allocation ceiling. Eight successful MiB do not establish unlimited
browser memory. The earlier zero-field incident in
[P3](REPORT_P3_DRAFT.md) was not deterministically reproduced; its later
memory warnings are a correlation, not proof that the kernel adopted a
zero budget. A read-only check in a later, fresh PID 64 measured low word
`0x14008001` and high word `0` before the second selector-3 test
([capture](../captures/bcbac7d896204ec18b9ae44503240ad2.json)).
This rules out that specific `0xffffffff` value persisting in the later
process's mapped root page; it does not measure hidden kernel accounting.

The measured bytes are consistent with the SDK-version slot. Whether
Sony's kernel re-reads that slot after process launch is unknown and no
longer a memory-budget question. Treat memory warnings as browser
interruptions until a controlled budget measurement distinguishes them
from WebProcess failure.
