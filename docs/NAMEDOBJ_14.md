# NamedObj family on PS4 14.00 (syscalls 557/558/551/555/556/560/616)

Status: characterized 2026-10-22 (sessions 51993346, 666bd5ee, f13bc554,
497430ca; archives `2026-10-22-device-probes.zip` and earlier). The
family is a working create/delete object allocator callable from the
WebProcess. No kernel bug found. The stale-handle/generation test
returned negative on 2026-10-22 (captures b835442c and 3045868d);
that stale-handle route is closed. A later kind-gate test reopened a
distinct 557/601 compatibility question (below).

## Confirmed behavior

- **557 creates an object with a caller name and kind.** A NUL-terminated
  name shorter than 0x20 succeeded. Calls with 0x20 or more consecutive
  non-NUL name bytes returned ENAMETOOLONG (63). Earlier probes varied
  arg2 together with that string length, so they did not establish arg2
  as a length parameter. The historical ABI treats arg2 as an object
  value; its 14.00 meaning has not been independently measured.
- **558(handle) = delete.** Returns 0 on live self-created handles.
  Double-delete returns ESRCH (3). Deleted slots stay gone
  (re-delete of slot 103: ESRCH).
- **551 = osem_open (canonical name, public table).** It shows the
  same name-limit behavior as 557 (ENAMETOOLONG on long shapes) and
  returns ESRCH for an unknown name. The `551_pair` probe created via
  **557**, not 551; 551 lookups of that name returned ESRCH before and
  after, and (handle, buf) returned EFAULT. The hitodama/libps4 table
  (`references/hitodama_include_sys_syscall.h`) names 551 `osem_open`
  — an Orbis-semaphore opener, not a creator and not a NamedObj
  sibling: 549 osem_create makes semaphores, 551 opens them, 550
  deletes them. That is why 557-created names never resolved in 551
  (different object type entirely). See `SYSCALL_NAMES_14.md`.
- **555/556/616 reject 557-created handles with ESRCH**; 595 too.
  **608 dynlib_info_ex rejects them with ESRCH** (extent stays at the
  caller-written 0x1a8 size word). The once-crashing 595 was the
  stale-address boot, not the syscall (0x1000-buffer rerun clean).
- **558 rejects real module handle 0x53 and system slot 103-class
  handles it did not create** (ESRCH, twice each); the 592 dynlib list
  is byte-identical before/after. No module deletion, no dynlib type
  confusion. 608/595 validate object type properly against our
  created objects.
- **arg3 does not control the handle layout** (handle_confuse probe),
  but a new 14.00 check shows it does control a kind distinction.

## Kind gate reopened on 14.00 (2026-10-22)

The [owned-object gate](../captures/ea8917da8f3344dab79b8acb5ed99138.json)
created handle 8288 with 557 arg3 `0x4000`. Calling 558 on that handle
with kind `0` returned `-1/ESRCH`; retrying with kind `0x4000`
returned `0` and cleaned it up. The page retained PID 62, restored its
JS carrier, and stayed connected. This directly establishes type-aware
lookup for the previously untested `0x4000` class. The prior arg3 sweep
only reached `0x2001`; unchanged handle numbers did not rule out a kind
effect. The [historical 1.01 analysis](https://fail0verflow.com/blog/2017/ps4-namedobj-exploit/)
uses `0x4000` to reach a debug-object class through 601 request 1.
That analysis is an ABI hypothesis, not proof of a 14.00 kernel bug.
The later owned-object request-1 comparison below tested one matching
name with zeroed fields and returned EINVAL. A different request shape
could alter kernel object fields, so any further experiment needs an
owned-object cleanup and readback strategy.
The initial 14.00 kind gate was verified from its pinned capture. An
independent fresh-page repeat was attempted but stopped before the
native-call setup: the per-page address locator could not verify a live
anchor. No repeated 557 or 601 call was queued on those pages.
[Calibration record](SESSION_CALIBRATION_14.md).

A later clean page completed native preparation and independently
repeated the kind gate ([capture](../captures/ee24009c67944bd08b1096dedc0c1780.json)):
557 created handle 24673 with kind `0x4000`, 558 rejected kind `0`
with ESRCH, and 558 kind `0x4000` deleted it. The [separate arg2/name
comparison](../captures/845ca14903354c7386bdc5377d509109.json)
created and deleted owned `0x4000` objects with arg2 `0` and with a
readable pointer value, while a longer NUL-terminated name returned
ENAMETOOLONG. This confirms arg2 is not simply the bound on name bytes
in those tested calls; its semantic effect remains undetermined. PID
62 and the native carrier were preserved. No 601 request was made in
these fresh-page checks.

The next same-page comparison used an identical zero-initialized
request-1 buffer and name first with no matching object, then with a
self-created `0x4000` object. Both 601 calls returned `-1/EINVAL (22)`
without changing the owned buffer. The 557 create returned handle 16487;
558 deleted it successfully, guards and PID 62 held, and the native
carrier was restored ([verified capture](../captures/3d7311c503f140ffbfa2893d8ba605a3.json)).
This tested request shape does not become valid merely by providing a
matching live 557 object. It does not rule out a different request
layout, selector, or field values. Do not repeat the same zero-field
request with a different owned name.

## Handle layout (the important detail)

Handle = **(generation << 13) | slot** — 13-bit slot index plus a
3-bit generation that increments by one each time the slot is reused
(0x00xx → 0x20xx → … → 0xE0xx, wrap). Evidence (slots probe, capture
8ffe449a):

- SlotB → 0x0069; after delete, next alloc reuses slot → 0x2069 (gen 1).
- SlotA → 0x8068 (gen 4); after delete → 0xA068 (gen 5).
- Pair probe: 8289 = 0x2061 (slot 0x61, gen 1).
- Confuse probe: Tzero → 0xC068 (slot 0x68, gen 6); Teighty → 0x4069
  (slot 0x69, gen 2).

Earlier "multiple sequential ID spaces, kernel round-robins" was a
misreading of the same data; the generation layout explains every
captured handle. Freed slots are reused by subsequent allocations,
often immediately: in the slots probe `SlotB` (0x0069) was deleted and
`SlotD` returned 0x2069, and in the gen test A (0xA061) was deleted and
B (0xC061) took the same slot on the next allocation.

## Negatives (closed shapes)

- **Name-length matrix**: lens 0x20–0x10000 over a 16 KiB no-NUL
  buffer all return ENAMETOOLONG (63) with zero guard hits — the
  name limit or terminator behavior is enforced. The previous probes
  changed arg2 at the same time, so they do not isolate which check
  produced the error. The 4.05 name-overflow variant was not observed.
- 557 create is bounded, 558 delete is double-delete-guarded.
- No lookup sibling of 557 was found in 545–621 that resolves its
  handles (555/556/616/595 all ESRCH on them).

## Open question — RESOLVED NEGATIVE (2026-10-22, capture b835442c)

**558 validates the generation bits.** The one-shot stale-handle test
(`clone_history_gen_stale_v1`, run solo on a verified chain):
allocate A → `0xA061` (slot 0x61, gen 5); delete A (0/ok); allocate B
→ `0xC061` (slot 0x61 reused, gen 6); `558(A)` → **ESRCH** — the
stale-generation handle was rejected even though the slot held a live
object; cleanup delete of B returned 0. A second run on the same
session (capture `3045868d`, slot 0x67, gen 0 → 1) repeated the ESRCH
with full cleanup. The NamedObj stale-handle UAF route is closed for
this shape. The residual 3-bit generation-wrap
alias (8 reuses) would only matter with an independent kernel
reference to the old object; none is known — not pursued. NamedObj
  stale-handle variant closed; the 557/601 kind interaction remains a
  separate question.

## Census context (545–668)

111 wrappers byte-checked (installer v25; the kernel-pointer triad
probes ran under v26 = v25 + caller64). Always-succeed class:
548/560(pl,ps)/563/564/565/566/585(ret 1)/596/599/606/617/620/639/
640/643. EPERM-gated: 559/600/602(ptr)/603/604/611/613/615(pid)/618/
623/628/636/642. ESRCH by-ID: 555/556/595/616/632/633/634.
ENOSYS for sampled values: 627/635/641. 601 request 4 returned 0; 610 returned 2 for 0xffffffff. A later 14.00 matrix returned ENOSYS for 619 with that input; the earlier capture truncated its 619 row. Name-keyed: 551(name-keyed,
create unproven), 607(dynlib lookup, ENOENT), 630(lookup, z→EFAULT). 592 requires size
≥0x1000 but copies 108 bytes before validating (EFAULT at 0x400).
**624 returned changing positive values** (~0x4050 on 2026-10-22). The historical name `get_vm_map_timestamp` is a competing interpretation; these values were not established as object IDs. 632/633/634 and 558 returned ESRCH for them. 659 (`dynlib_get_list2` historically) malformed
shapes returned ENOMEM/EFAULT; the 588 layout sweep
returned EINVAL/EFAULT; none copied data.

## 661 — malformed-call WebProcess termination

Four calls to 661 with zero or mapped-buffer arguments ended the
WebProcess before a return capture (last markers `k2_before_661_buf`
and `k3_before_661`; no console panic). The historical public name is
`aio_submit`, not the formerly hypothesized intentional process exit.
The current 14.00 ABI and fault cause remain unverified. Do not infer a
kernel effect from the page refresh; use an independently valid AIO
control before revisiting this route.
