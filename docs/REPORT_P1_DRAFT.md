# [P1] DRAFT — Userland Browser Chain (PS4 firmware 14.00)

Status: draft for internal review. Environment: retail PS4, firmware
14.00, stock browser (WebProcess). Detailed run-by-run evidence lives
in the `docs/HISTORY_*.md` series; this document is the chain-level
summary with the load-bearing evidence links.

## 1. Summary

A memory-corruption bug in the browser's History-clone deserialization
path yields a forged typed-array view over arbitrary process memory.
From that single primitive we escalate, entirely within JavaScript,
to: stable cross-allocation read/write, object-address calibration,
live JS-value storage manipulation, native function-call redirection,
a full ROP chain invoking byte-verified syscall wrappers from two browser
threads. A former kernel-address claim based on syscall 638 has been
withdrawn after reconciling its outputs with time conversion.

## 2. The core vulnerability

A deserialization mismatch in the History API's clone path produces a
typed-array whose backing-store pointer is attacker-influenced
("forged view"). Full finding and controls:
[CLONE_INTEGRITY_FINDING.md](CLONE_INTEGRITY_FINDING.md),
[HISTORY_14_RUNS.md](HISTORY_14_RUNS.md). The view is established per
page session with an address-calibration step (leaked object word →
page-aligned view base), re-validated on every fresh page.

## 3. Exploit architecture (primitive ladder)

Each rung was repeated on fresh pages with restoration checks:

1. 1-byte OOB read/write past a resizable buffer
   ([HISTORY_NATIVE_OOB_14.md](HISTORY_NATIVE_OOB_14.md)).
2. Neighbor and fixed-buffer cross-class writes
   ([HISTORY_NEIGHBOR_RW_14.md](HISTORY_NEIGHBOR_RW_14.md),
   [HISTORY_FIXED_BUFFER_RW_14.md](HISTORY_FIXED_BUFFER_RW_14.md)).
3. Freed-slot reuse control
   ([HISTORY_SLOT_REUSE_14.md](HISTORY_SLOT_REUSE_14.md)).
4. Address-directed read/write among measured backing stores;
   JS-value storage manipulation (object identity swap through the
   view) ([HISTORY_JSARRAY_STORAGE_14.md](HISTORY_JSARRAY_STORAGE_14.md),
   [HISTORY_ADDRESS_DIRECTED_RW_14.md](HISTORY_ADDRESS_DIRECTED_RW_14.md)).
5. Bound-call-target redirection: a live bound `Math.expm1` call
   executes `Math.log1p` after a view write, then reverts.
6. WebKit code discovery + 15 gadget signatures validated in-process
   ([VALIDATED_GADGETS_14.md](VALIDATED_GADGETS_14.md)).
7. Full ROP chain (argument-load gadgets → syscall wrapper → result
   frame pivot) executing the number-20 wrapper, then arbitrary
   syscalls via byte-located wrappers
   ([HISTORY_NATIVE_CALL_14.md](HISTORY_NATIVE_CALL_14.md)).
8. Two-thread concurrency: page and worker-side independent plans,
   overlapping native calls, event wait/wake
   ([SANDBOX_WORKER_PATH_14.md](SANDBOX_WORKER_PATH_14.md)).
9. Process identity: getpid returns the WebProcess PID; UID query
   returns 1; 585 `is_in_sandbox` returns 1
   ([SANDBOX_BOUNDARY_14.md](SANDBOX_BOUNDARY_14.md)).

## 4. Correction to the former syscall-638 claim

The earlier draft called the result of syscall 638 with input zero a
“candidate kernel base” after subtracting a chosen offset. That claim
is **withdrawn**. A [public syscall table](https://github.com/a0zhar/PS4-SCE/blob/main/syscalls.md)
labels 638 `utc_to_localtime`, and the three first outputs in the
[14.00 pass capture](../captures/c96e6f151afb44d08b128512750f1df5.json)
are each exactly the input minus 21,600 seconds (six hours). This is a
timezone conversion signature, not a kernel-address disclosure.
The extra output structure was not decoded under the time ABI; its
pointer-shaped values cannot be used as kernel pointers. Full arithmetic
and capture provenance: [corrected 638 record](KBASE_CONSTANCY_14.md).

No KASLR bypass or kernel-memory access is established by this chain.
The browser-process read/write and native-call milestones in §§2–3 are
supported independently by their device captures.

## 5. Reproducibility notes

- Per-page chain build success is high after replacing hardcoded
  layout windows with live-derived bounds (groom scan bounds derive
  from the forged view length; a stale 2 MiB constant caused a
  seven-page failure streak).
- All wrapper addresses are re-located per session by byte pattern;
  no absolute addresses cross sessions.
- Full state restoration is verified after every native call;
  every experimental probe in this report ended with the browser
  process alive or was attributable to a single documented exception
  (the 661 finding, P3).
