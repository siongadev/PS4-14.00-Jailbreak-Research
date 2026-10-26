# Owned executable mapping on retail PS4 14.00

The already calibrated WebProcess native caller used the byte-checked
number-477 `mmap` and number-73 `munmap` wrappers to compare three
anonymous private 16 KiB mappings. The identical length, flags
`0x1002`, and fd `-1` were used in every arm; only the requested
protection changed. The [verified capture](../captures/01c92b42d07047b7b13c24243c54dfe7.json)
reported mapped user addresses for RW (`3`), RX (`5`), and RWX (`7`).
All three `munmap` calls succeeded; browser PID 63 and the native
carrier were intact. [Exact probe](../probes/clone_history_anon_exec_map_gate_v1.js).

This establishes that the tested `mmap` calls **accept** the RWX flag
combination and return page-aligned addresses. It does not by itself
prove that those pages are writable and executable in practice.

A follow-up [caller install](../captures/09b2c97ae7074680be7a510059950e98.json)
added a routine that maps RWX, writes a 16-byte x86-64 leaf function,
checks its bytes, invokes it through the existing restored ROP chain,
and unmaps. The first [owned-code command](../probes/clone_history_owned_native_code_v1.js)
reached its `owned_code_before` marker but did not deliver an after
marker or result. The operator reported an immediate memory warning,
followed by page refresh. That marker alone cannot locate the failure
among map, write, readback, invocation, and cleanup.

On the refreshed retail 14.00 page, the [held-mapping VM query](../captures/2ab5731c6f214b1ba5071b0ef59b2f1b.json)
returned **effective protection 3 (read/write)** for a page whose
`mmap` request specified 7 (read/write/execute). The map was unmapped,
PID 66 remained intact, and the capture verified. A separate
[three-arm VM-map comparison](../captures/9a6aa9388c6b4578bfb58525486a8d02.json)
returned `RW 3→3`, `RX 5→1`, and `RWX 7→3`; each page was queried while
held and then unmapped. [Exact source](../probes/clone_history_anon_exec_vmmap_matrix_v1.js).
The tested anonymous mapping route strips the execute bit on this
14.00 browser, even when `mmap` itself succeeds. This explains why an
owned-code attempt is not evidence of generated-code execution. It does
not locate the precise instruction that caused the warning, and it does
not test every mapping or `mprotect` route. The already reproduced
native **code-reuse** caller remains the WebKit-process execution result.

The current-page caller then located and byte-checked the number-74
`mprotect` wrapper ([install](../captures/677698a0c2dd4694b853bd11b9589722.json)).
A [matched transition test](../captures/aaf7d31664c1473a8dc4016ec898bb30.json)
mapped two new owned RW pages. Requests to change them to RX and RWX
both returned `-1/EACCES` (errno 13), and VM-map queries still reported
effective protection `3` for both. Each page was unmapped; PID and the
carrier remained intact. [Exact source](../probes/clone_history_anon_mprotect_gate_v1.js).
Thus the tested anonymous-map and ordinary permission-transition routes
do not provide generated-code execution from this browser. A distinct
JIT or file-backed mechanism would need its own device evidence; none is
established by these captures.

The browser's number-379 wrapper, historically called `mtypeprotect`,
was separately located and byte-checked on the same 14.00 page
([install](../captures/9bda72e203534aca89b61b5b3eab0e7c.json)).
One bounded four-argument shape `(owned RW page, 0x4000, requested
protection, 0)` returned `-1/errno 45` for requested RX and RWX.
VM-map readback stayed `3` in both arms, and both pages were unmapped
([capture](../captures/431fc2768b8b4347acfb81988134a18f.json),
[source](../probes/clone_history_anon_mtypeprotect_gate_v1.js)). The
14.00 argument contract is unknown, so this closes only the tested
shape; it does not prove the whole interface is unavailable.
An otherwise matched **RW→RW no-op** also returned errno 45 and left
the page RW ([control](../captures/98df3213cdeb445aa92cd83523ce8d77.json)).
That control does not validate the guessed four-argument ABI. Further
number-379 flag sweeps would be uninterpretable without a 14.00 caller
or other argument-contract evidence.
