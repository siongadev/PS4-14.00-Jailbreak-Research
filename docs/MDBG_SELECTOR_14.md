# Syscall 601 selector interruptions on PS4 14.00

On 2026-10-22, the calibrated page session `65f9f55c943e41d7906e3d6b8efc4459`
ran pinned probe `clone_history_mdbg_selector23_v1` (command
`c53960a199c3467a8f5c837bba7ccca6`, source SHA-256
`036592c613f02438703f9f9949ae2e669a7bde546dd6137b16ac61e975016e1c`).
Its authenticated markers were `mdbg2_before`, `mdbg2_after`, and
`mdbg3_before`. No `mdbg3_after` marker or result capture arrived.
The probe only enters selector 3 when selector 2 returned `-1`, left
its owned zero buffer unchanged, and preserved the three measured
sandbox/development/path indicators. Because the command stopped before
submitting a result, selector 2's errno is unknown.

The operator saw the PS4 memory warning, dismissed it, and reported
that the research page refreshed and remained connected. Settings →
System → Error History had no new browser or system entry. The old
session stopped polling at the claim time; a new session appeared after
the refresh. The warning is temporally associated with syscall 601
selector 3 and an owned zero buffer. It is not a captured syscall
return, proof of a kernel fault, or a sandbox escape.

The independent null-argument discriminator ran on fresh page session
`659c7433783d44e3ada55e40d99f5811` after all seven page-local setup
gates passed. Before the call, a read-only syscall-598 check recorded PID
64 and an unchanged ProcParam root field: low word `0x14008001`, high word
`0` ([capture](../captures/bcbac7d896204ec18b9ae44503240ad2.json)).
The single selector-3 command `84e12583081641a393193ec886cc3857`
sent the authenticated `mdbg3_null_before` marker at 21:33:43 UTC. No
`mdbg3_null_after` marker or result capture arrived. The operator reported
the memory warning. A new page session appeared shortly afterward.

Thus selector 3 interrupted the browser in two different argument shapes:
an owned zero buffer and null. The owned buffer is not required for this
observed failure. Neither run captured a syscall return or a kernel fault
signature, and there is no observed authority change. Retire selector 3
from device testing until a distinct, source-backed input and outcome
oracle can separate a browser-process fault from a kernel-side effect.

## Null-argument selector sweep after 3

With a separately calibrated caller on session
`c9c744a1ef714b679b412650ca09d12f`, command
`0632530c0ca3448c9dfd677f5e581ce7` marked immediately before each
601 call. The collector received markers before selectors 5, 6, 7, and
8, in order, then no result capture or further polling. Thus calls 5–7
returned control to JavaScript but their individual return codes were
lost when the later call interrupted the page. The operator reported a
**frozen browser**, not the earlier memory warning. This run used a null
second argument for each selector. The last authenticated marker was
`m05_before_8` at 21:47:01 UTC.

After reopening the browser and rebuilding the native caller from that
new page's addresses, command `fdae3f1c860848fab2dc208a67567fbe`
marked before selectors 9, 10, 11, and 12. Again there was no result
capture or subsequent poll after the last marker, `m09_before_12` at
21:48:53 UTC. The operator then saw the browser prompt “this page is not
responding” and “Do you want to stop processing this page?” Choosing to
stop led to a memory warning and a refreshed, responsive page. Calls
9–11 returned control far enough
to reach the next marker, but their return codes are likewise unknown.
No kernel fault record, return value, or boundary change has been
captured for selectors 8 or 12.

A later fully calibrated 14.00 page ran selectors 25 and 26 separately,
capturing `0` and `-1/EFAULT` respectively. A three-selector command
then marked before 25, 26, and 27, but yielded no result after the
last marker (`m25_before_27`; command
`7ace28cc7780492fb38de4330ad4bb8e`). The operator reported a
memory warning and refreshed page. A fresh page separately confirmed
25 and 26's returns; the interruption therefore localizes to selector
27 or its return path, but does not identify a kernel fault or escape.
[Return captures: 25](../captures/5241efe7cf884b048f969ee29ded3d16.json),
[26](../captures/a753e0bcdc91435882d760752ae25009.json).
