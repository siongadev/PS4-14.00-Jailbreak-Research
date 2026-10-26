# [P3] DRAFT — System Architecture Behavior & Caching Profiles (PS4 firmware 14.00)

Status: draft for internal review. Companion to P1 (browser chain) and
P2 (privilege manifest). Environment: retail PS4, firmware 14.00,
WebProcess context.

**2026-10-24 correction:** This draft's `+0x10/+0x14` “memory-budget”
interpretation and kernel-cache inference are superseded by a fresh
[14.00 read](../captures/2ff1cec730dc4f758f8f49c8ab1d930a.json)
and the [field audit](PROCPARAM_MEMORY_14.md). The measured low word
`0x14008001` matches the independently queried SDK version and the
published ProcParam SDK-version slot. The high word is zero. The earlier
mutation and warning captures do not prove a memory-budget change or
kernel re-read. Preserve the incident record, but do not cite its
memory-limit hypothesis as a finding.

## 1. Summary

Three architecture-level behavior profiles from live probing: (a) the
process parameter block exposed by syscall 598
(`dynlib_get_proc_param`) is **userland-writable at its root page but
hardware-enforced read-only at its descriptor sub-structures**, with a
launch-time caching profile that makes post-launch edits invisible to
the state oracles; (b) malformed calls to syscall 661 repeatedly ended the WebProcess; historical tables identify it as `aio_submit`, so intentional process exit is no longer a plausible interpretation; (c) the `SceSysCoreApp` /
`SceSysCoreApp2` IPC connect path is **non-lethal from a worker
thread** (clean −1/ESRCH), closing the earlier "connect coincided
with a memory warning" incident as environmental.

## 2. ProcParam blueprint (syscall 598)

`dynlib_get_proc_param` returns a pointer to the browser's
kernel-visible process parameter block: a page-aligned mapping with
`ORBI\05` magic, a word `0x14008001` at +0x10, a string table
(`SceNKWebProcess`, `SceNKWebProcessMain`, `FMEMSizeLimit`,
`DefaultThreadPriority`, arg-format strings — consistent with a
launch-parameter/attribute block), and descriptor sub-structures
referenced from +0x38/+0x40/+0x48. Pointer walk across four boots,
all fresh-derived per session: captures `0d7c9872`, `37d3cca4`,
`86dbf37c`, mut2 `90835b2f`.

Experimental profile (mutator series `procparam_mutate_v1`,
`procparam_mut2_v1`, `procparam_mut3_v1`):

- **Root page: userland-writable.** An identical-value 8-byte write
  gate at +0x10 passed and read back clean (marker `pp_ro_ok`).
- **+0x10 mutation (0x14008001 → 0) is a racy killer — attribution
  not demonstrated.** First run: WebProcess died inside the
  mutation→oracle window. Byte-identical rerun on a fresh boot
  survived a 200 ms syscall-free window, all four state oracles
  unchanged (`585 is_in_sandbox` = 1, `606 is_development_mode` = 0,
  `607` EFAULT, `600` EPERM), clean restore. Capture `90835b2f`.
  ⇒ The death is *consistent with* an asynchronous kernel consumer of
  the field, but the causal link is not established (the rerun
  surviving the same window undercuts a deterministic consumer, and
  the first-run death was not reproduced). What is established: no
  *synchronous* kernel check behind this field, and the four state
  oracles do not consult it post-launch.
- **Descriptor sub-structures: read-only.** The identical-value write
  gate on the +0x38 descriptor mapping (a separate page) faulted and
  killed the process instantly (markers stop at `pp3_snapok`) — CPU
  permission enforced; descriptor mutation is impossible from
  userland.
- **Persistent OOM footprint (open observation).** After the first
  mutating run, *newly spawned* browser pages hit immediate
  memory-exhaustion on allocation waves without any further mutation,
  clearing only on console reboot. Consistent with kernel-side
  caching of a value derived from the mutated page (the block's
  string table carries `FMEMSizeLimit`), i.e. kernel consumption of
  user-mutable ProcParam content observed via side effects.
  Unreproduced cleanly; flagged for follow-up.

Interpretation: ProcParam attribute decisions are consumed at process
launch; post-launch mutation of the writable root page is invisible to
the state oracles, and everything structurally interesting is
read-only. The data-only configuration vector is closed from a running
process context.

## 3. Syscall 661 — browser termination under invalid AIO calls

Four 14.00 attempts at number 661 ended the WebProcess before a result
was captured: zero arguments (marker `zc_before_661`), a mapped buffer
(`k2_before_661_buf`), and after calls to 658/659/660
(`k3_before_661`). The browser recovered; the console did not panic.
These observations establish process termination during malformed calls,
not a deliberate exit behavior or a kernel exploit.

The [public syscall table](https://github.com/a0zhar/PS4-SCE/blob/main/syscalls.md)
identifies 661 as `aio_submit`, 659 as `dynlib_get_list2`, and 660 as
`dynlib_get_info2`. This corrects the earlier guess that 661 was an
intentional exit syscall or that 659's ENOMEM meant it allocated an
object. The 14.00 ABI is not reconstructed; the existing probes do not
show why the WebProcess ended. This line needs a valid AIO control
before any security conclusion and should not be batch-tested with
unrelated calls.

## 4. IPC channel state — SceSysCoreApp / App2

- `SceSysCoreApp` connect (raw `ipmimgr_call`): reachable, session
  established to the browser's parent PID, cleanly queried and closed
  (read-only); a raw sync-method attempt preceded the 2026-10-21
  console stop (CE-36329-3). Official first-path/app-info getters
  return `0x80AA000B` cleanly post-reboot, blaming the raw marshaling.
  Spawn-shaped method `0xaa110003` identified offline, never called,
  gated.
- `SceSysCoreApp2`: an earlier page-side connect coincided with a
  memory warning. **Resolved by the worker discriminator (2026-10-22):**
  the identical connect issued from a WebWorker returns clean
  −1/ESRCH (`app2_errno = 3`) in 2/2 instrumented runs — no hang, no
  warning, no thread or process effect (captures `606cb668`,
  `65ebf96e`). The earlier warning was environmental; the
  thread-kill-vs-process-kill question is moot.
- No unauthorized method invocation, sandbox escape, or cross-process
  effect has been attempted or observed on any IPC channel.

## 5. Impact

These profiles document where 14.00's user/kernel boundary is
hardware-enforced (ProcParam descriptors), where state is
launch-cached (ProcParam root), that malformed 661 calls ended the caller
without establishing the cause, and the measured SysCore IPC connect
response. They bound the exploitation surface available to a
WebProcess attacker and correct two earlier incident attributions
(595's crash — see [SYSCALL_NAMES_14.md](SYSCALL_NAMES_14.md) and
[NAMEDOBJ_14.md](NAMEDOBJ_14.md); App2's warning) as environmental.
