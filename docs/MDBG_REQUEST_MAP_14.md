# Syscall 601 request map on the retail PS4 reporting 14.00

This record uses the current project's per-page address calibration and
byte-checked number-601 wrapper. A return value is a native WebProcess
syscall return, not evidence of kernel control. Each batch has a pinned
probe source and capture; interrupted batches have authenticated markers
but no return capture. The browser's user agent says `PlayStation 4/14.00`
and the operator separately checked System Information.

## Null second argument

| Selectors | Observed result | Evidence |
| --- | --- | --- |
| 0 | Null arg2: EFAULT. Owned 256-byte arg2: `0`, exactly eight bytes overwritten with little-endian `0x100` | [Output and controls](MDBG_REQUEST0_STATUS_14.md) |
| 2 | ENOSYS with null remaining arguments | [capture](../captures/8e413f53a4f1412cadb238db72c2f23e.json) |
| 5, 6, 7 | ENOSYS, ENOSYS, `0` | [capture](../captures/19d89a7358fe4a8f9464091c53e8adee.json) |
| 8 | No return; browser froze | Command `0632530c0ca3448c9dfd677f5e581ce7` ended after `m05_before_8`; operator saw frozen browser. |
| 9, 10, 11 | `0`, EPERM, `0` | [capture](../captures/78fe833cad2341669c3287c3916d5f3c.json) |
| 12 | No return; unresponsive-page prompt, then memory warning when stopped | Command `fdae3f1c860848fab2dc208a67567fbe` ended after `m09_before_12`; operator reported both screen events. |
| 13, 14, 15 | `0`, EFAULT, EPERM | [capture](../captures/bb9414c87eaf46a5b9b1fa9cc567cdf9.json) |
| 17, 18, 19 | EFAULT, EFAULT, `0` | [capture](../captures/30df2e74fb394f8abda0c205411ed298.json) |
| 20 | `0` | [capture](../captures/ebafaeba1529444391cca217ec215cfc.json) |
| 21, 22, 23 | EPERM, ENOSYS, ENOSYS | [capture](../captures/ac41a663f94c4ec586bb8d6b4b41574b.json) |
| 24, 25, 26 | EPERM, `0`, EFAULT | [24](../captures/a102a71e7d4a464fba0e9fcce8025968.json), [25](../captures/5241efe7cf884b048f969ee29ded3d16.json), [26](../captures/a753e0bcdc91435882d760752ae25009.json) |
| 27 | No return; memory warning and refreshed page | Command `7ace28cc7780492fb38de4330ad4bb8e` ended after `m25_before_27`; operator reported warning. |
| 28, 29, 30, 31 | EFAULT, `0`, EINVAL, EFAULT | [28](../captures/5235260204a949488979934627b17086.json), [29–31](../captures/54116c9fd5fa423c8d9b7166959ee742.json) |
| 32, 33, 40, 64, 96, 128, 255 | `0` for 32; ENOSYS for the six sampled higher values | [capture](../captures/0f9dcccc111e447591e5e3c8035d1282.json) |

Request 3 separately interrupted the browser with a memory warning for
both null and owned-buffer second arguments; see the [selector
record](MDBG_SELECTOR_14.md). Request 4 returned `0` in multiple earlier
14.00 checks. The gap at 16 and unlisted values above 32 are not
filled by this table; do not extrapolate the sampled upper values to a
complete dispatch limit.

## Owned-buffer and authority checks

The successful selectors 7, 9, 11, 13, 19, 20, 25, 29, and 32 were each
called again with a process-owned 256-byte second-argument buffer,
position-encoded fill, and a guard. Every call returned `0`, wrote zero
observed buffer bytes, left the guard intact, and preserved the browser
PID. Before and after each call, `is_in_sandbox`,
`is_development_mode`, and `sandbox_path` returned the same tuple
`1,0,-1/EPERM`. Captures: [7](../captures/dd5f251f50a94e4091387f0fcb710b84.json),
[9](../captures/624b2b8834694cc688ad2a26c03d0653.json),
[11](../captures/509bba7000334224b7e8c8a2fb4fc91c.json),
[13](../captures/879a04e7f4634a34a5adb52161b5406e.json),
[19](../captures/2d6300d7ec7342218d274e1b839f266d.json),
[20](../captures/1fffc503a6014e59a29f759b8763c217.json),
[25](../captures/9dad21e1b6ff44308b427c9b6f453161.json),
[29](../captures/40e2fdcb90f4479f8852e53aac2efaac.json),
[32](../captures/a79d952ea87141ab9e616c93b3464093.json).

These observations rule out a simple arg2 copyout or change to those
three measured authority indicators for the tested calls. They do not
show that a successful selector is a no-op; it could alter another
process-local or kernel state that this run did not measure. The
interrupted selectors have no return or kernel fault signature and no
demonstrated sandbox escape.

A separate request-4 pointer matrix passed four arg2/arg3/arg4 shapes,
including two process-owned buffers. Each returned `0`, changed neither
buffer, and preserved the guard and PID ([capture](../captures/4e37de3a65cd414fa7f844891190eb0f.json)).
This narrows the tested output contract; it does not identify the
request's action.
The new request-0 eight-byte readback stayed `0x100` before and after
request 4 and after nine other successful selectors. This supplies a
bounded status oracle but no observed authority change; [exact captures
and limits](MDBG_REQUEST0_STATUS_14.md).

Request 1 remained `-1/EINVAL` across a zeroed input and nine isolated
field changes, all with the same absent name at offset `0x28`. The
buffer and guard stayed unchanged ([capture](../captures/c385679226e84e97bbe08bf02eaf5772.json)).
The first run stopped after four calls because it exhausted the
collector's per-command synchronous-marker limit, not because the
browser failed ([collector-error capture](../captures/22f866e2b05b4a3b836e9d803ec6c9b5.json)).
The corrected, separately pinned run completed all ten shapes. None
reached an observable object lookup or output path. No lower-firmware
request layout has been assumed valid on 14.00.

Three additional 14.00 runs varied only the first 32-bit input word
across 17 values, from `2` through `0xffffffff`; all remained
`-1/EINVAL` with no buffer write. Separate two-pointer calls moved
request 31 from `EFAULT` to `EPERM` and request 14 from `EFAULT` to
`0`, with no observed output or authority-indicator change. The next
comparison stopped reporting at request 28 and has no return capture.
[Pointer-gate record and exact evidence](MDBG_POINTER_GATES_14.md).
