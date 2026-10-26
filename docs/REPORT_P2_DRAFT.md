# [P2] DRAFT — Syscall census and corrected ABI interpretation (PS4 14.00)

Status: internal research record, corrected 2026-10-22. Device: retail PS4
14.00 browser WebProcess, UID 1, `is_in_sandbox` (585) returns 1.
The earlier version of this draft described a 601/615 *pointer-domain
anomaly*. That interpretation is **withdrawn**. The measurements remain
valid, but the first arguments were assigned the wrong semantics.

## What the 14.00 captures establish

The browser's native-call chain byte-checked 111 wrappers in the
545–668 range and recorded return values. The completed brute-force
chunk-3 [capture](../captures/49ff05f8aa2e4515b008cdc6720ee3a6.json)
(SHA-256 `a5d754be1dac936b776ae2a8b6ba381b5a331f24e7fa2276af2270e46a731aec`)
used first-argument integers `1, 4, 16, 256, 0xffffffff` with all other
arguments zero. Its printed labels are hexadecimal: `10` means 16.

| Call | New observation | What is established |
|---|---|---|
| 601 / `mdbg_service` | arg1=4 returned 0; 1 returned EFAULT, 16 returned EINVAL, 256 and `0xffffffff` returned ENOSYS | At least one request value reaches a successful path. Calling 601 an unconditional ENOSYS stub is wrong. The action performed by request 4 is unknown. |
| 595 / `dynlib_unload_prx` | arg1=16 returned 0; other sampled integers returned ESRCH | A loaded-module handle was accepted. Whether a module was removed is not established because that session has no before/after 592 list. |
| 610 / `budget_get_ptype`; 619 | 610 returned 2 for `0xffffffff`, with no change to an owned second-argument buffer. A separate 16-case 619 matrix returned ENOSYS throughout. | The earlier 619 “2” claim came from a truncated row and is withdrawn; neither call showed an authority or memory effect. |
| 624 | Repeated calls returned changing positive numbers | The numbers were not shown to be allocated object IDs. Historical public tables name 624 `get_vm_map_timestamp`, which could account for changing values; that ABI must be checked against 14.00 before assigning meaning. |
| 548, 560, 615 | 548 returned 0 for sampled values; 560 depended on input; 615 returned EPERM in the integer sweep | No sandbox escape or kernel-memory effect follows from these return codes. |

The older [PS4 syscall table](https://github.com/a0zhar/PS4-SCE/blob/main/syscalls.md)
labels 595 as `dynlib_unload_prx`, 601 as `mdbg_service`, 610 as
`budget_get_ptype(int budgetID)`, 615 as
`get_resident_fmem_count(int pid)`, and 624 as `get_vm_map_timestamp`.
These are *ABI hypotheses* for 14.00, not evidence that the implementation
is unchanged. [fail0verflow's older kernel analysis](https://fail0verflow.com/blog/2017/ps4-namedobj-exploit/)
shows `mdbg_service` dispatching on the first argument and treating the
second as a user pointer for request 1. The 14.00 request-1 EFAULT with
arg2=0 is consistent with that layout. It does not prove that request 4
has the same body or any useful side effect.

## Correction to the prior pointer-domain claim

Prior probes P2a (`ae6d4a46`), P2b (`0bfe0216`), and triad
(`b84fd1b6`) passed mapped-user, unmapped-user, and high-half values
as **arg1** to 601 and 615. They then compared their errors to syscall
612, whose public prototype really does take an output pointer. This
was not an apples-to-apples address validation test:

- For 601, arg1 is plausibly a request selector. Different values may
  select different branches or fail dispatch before arg2 is considered.
- For 615, the public prototype calls arg1 a PID. Large 64-bit inputs
  may be narrowed or rejected according to PID rules.
- The `0xFFFFFFFF`-high-word pattern in the old draft is therefore a
  selector/argument-value observation, **not** a kernel mapping oracle.

No kernel read/write, missing user/kernel validation, or sandbox escape
can be inferred from these captures. The older P2 claims that 601 and
615 were pointer-domain anomalies, and that 601/610 were unconditional
ENOSYS stubs, are superseded by this correction.

## Next discriminators

1. On a fresh 14.00 page, take a read-only 592 module-list baseline.
   Then call 595 once with handle 16, take a second 592 list in that
   same process, and verify PID and browser responsiveness. A return of
   0 alone is insufficient.
2. Recheck 601 request 4 separately with bounded, known arguments and
   an observable output or state control. Avoid broad request sweeps:
   the two subsequent sweep commands stopped reporting before a
   capture, so they establish no additional 601 result.
3. Confirm the 624 contract before treating its changing return values
   as handles or pursuing 632/633/634 as pairing calls.

The follow-up on 14.00 established that handle 16 disappeared from a
same-PID module list after the 595 call. Request 4 returned 0 again but
ignored both an owned arg2 buffer and invalid arg2=1 in the tested
shapes. Request 1 with a readable zeroed buffer returned EINVAL rather
than the null buffer's EFAULT. The exact captures and limits are in the
[brute-force follow-up](SYSCALL_BRUTE_14.md).

The syscall census remains useful as a routing map, but the remaining
goal requires a reproducible unauthorized effect or a verified kernel
data primitive. A process-local module unload and return-code
differences by themselves do not pass it.
