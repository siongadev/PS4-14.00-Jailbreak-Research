# Clock ID 16 read-only gate on retail PS4 14.00

Updated 2026-10-25. The [FreeBSD 15 timer advisory](https://www.freebsd.org/security/advisories/FreeBSD-SA-26:51.ktimer.asc)
requires a `CLOCK_TAI` timer. FreeBSD 15 defines `CLOCK_TAI=16` in
[`_clock_id.h`](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/15/sys/sys/_clock_id.h),
while FreeBSD 14 does not. These are upstream facts; PS4 clock IDs and timer
semantics require separate device evidence. The checks below only queried
clocks. They did not create or arm a timer, request an old timer value, or
attempt a kernel-memory disclosure.

The local collector served the retail console reporting 14.00 on session
`8c0e9539dd244641a99b86aea7a196f3`. The fresh-page, address-derived
native preparation passed all seven gated stages, ending with byte-checked
number-20 `getpid` control PID `62` ([setup capture](../captures/88bc323d9b6e4693bffbc138e05fa45f.json)).
The narrower [v59 installer](../captures/932b06ed2b114148aece0269751c9418.json)
found and byte-checked fixed wrappers 232 and 234, repeated PID `62`, and
restored the carrier. Those numbers match upstream `clock_gettime` and
`clock_getres` in the [FreeBSD syscall table](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/15/sys/kern/syscalls.master);
the observed 14.00 output shapes supply the current-device support for
those names.

The [first valid read-only capture](../captures/dbb7ee58b63b4c5ab24c36fe4753486c.json)
(verified SHA-256 `2723994d7d4a053b9a954357a3041962e27ba7600d5423a19ad982a4f658e08c`)
used owned 16-byte output and a realtime ID-0 control:

| Call | Return | Output or error |
| --- | --- | --- |
| 232, clock 0 | 0 | 16-byte timestamp, plausible nanoseconds |
| 234, clock 0 | 0 | resolution 81 ns |
| 232, clock 16 | 0 | 16-byte timestamp |
| 234, clock 16 | -1 | `EINVAL` (22); output sentinel untouched |

The page PID stayed `62`, the output guard and native carrier remained
intact, and the owned frame was restored. The [second capture](../captures/cc366bf74cc049018df2df480a44f515.json)
(verified SHA-256 `b8fc2893887e73adae57f1d88749435f3086de97f332dbc1709b17e935933d01`)
put four read-only number-232 calls into one native continuation, in the
order `0, 16, 0, 16`. Each returned zero with valid nanoseconds. Clock 16
was 1,500 ms ahead of clock 0 in both adjacent pairs. The four outputs,
PID, guard, carrier, and frame restoration are preserved in the capture.

In [FreeBSD 15 `kern_time.c`](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/15/sys/kern/kern_time.c),
`kern_clock_getres()` explicitly accepts `CLOCK_TAI` and returns a
resolution. The PS4 14.00 number-234/ID-16 `EINVAL` therefore conflicts
with that upstream contract. The precise 1.5-second offset is another
14.00-specific behavior to explain; it is not evidence that Sony called
the clock `CLOCK_TAI`. **The FreeBSD 15 timer-disclosure advisory does not
pass an implementation-equivalence gate on current evidence.** A Sony
kernel handler or timer-specific source match would be needed before
using that advisory to motivate a timer operation.

Two calibration attempts are retained for provenance. The [v58
installer](../captures/989061fc6308440bb9c8e82539f59d60.json) stopped
at `system_service_map_missing` during preflight; no clock call ran.
The [v1 clock probe](../captures/98f1dbec1c344e188c6e5fb26593b2a0.json)
ran both ID-16 calls and emitted before/after markers, but its report
exceeded the collector's 12-field limit and was rejected. Its exact
source was retained under the original hash; the valid v2 capture above
uses a reduced report. No result is inferred from the rejected report.
