# Parent-thread signal-zero boundary on retail PS4 14.00

This run used the current page's native caller and exact byte-checked
number-432 and number-481 wrappers. The [FreeBSD `thr_self` manual](https://man.freebsd.org/cgi/man.cgi?manpath=FreeBSD+11.0-RELEASE&query=thr_self&sektion=2)
suggested the output-pointer shape; the return and owned-buffer write
below establish the tested shape on this 14.00 WebProcess. Historical
FreeBSD names do not prove Sony kept its implementation.

On page session `6780d62a1b2e41f7a4758525a146c534`, PID `71`, the
number-432 call returned `0` and wrote current TID `101047` to an owned
eight-byte output. Number 481 with `(PID 71, TID 101047, signal 0)`
returned `0`. With the browser's parent PID `38` and that *wrong* TID,
it returned `-1/ESRCH`; ordinary `kill(38, 0)` returned `-1/EPERM`.
All guard bytes and the browser PID held
([calibration capture](../captures/bc574ed0215841779a29cb24cc26f15d.json)).

The pinned [scan probe](../probes/clone_history_thr_parent_tid_scan_v1.js)
tested at most 128 descending TIDs per command, starting immediately
below the measured self TID, and stopped at the first result other than
`ESRCH`. The first six windows returned `ESRCH` for all 768 IDs
([round 1](../captures/b15b8f2b1736495e81e01a2533db8c58.json),
[2](../captures/a3acae9d68d343d9b779e075ab074494.json),
[3](../captures/981a90e189ed447f9126539e70c2e470.json),
[4](../captures/9f6cf3d8ef58424dbbdfe7e8d3929772.json),
[5](../captures/941a47126163417b8e37e6f4e2c34402.json),
[6](../captures/04561682419f4f16b7818e454acd8b79.json)).
Round seven reached TID `100194` after 85 more calls and returned
`-1/EPERM` ([capture](../captures/30a31cb8d26848bfa28aee7e5737bae2.json)).
The result is consistent with a real parent-process thread protected by
the permission check; no parent thread data was read.

An independent pinned [confirmation](../probes/clone_history_thr_parent_tid_confirm_v1.js)
derived that TID from the same page's scan state and twice repeated
`-1/EPERM`. The wrong-TID parent control stayed `ESRCH`, the own-TID
control stayed `0`, and `kill(parent, 0)` stayed `EPERM`
([capture](../captures/d0cf7c2414a14423acbd144f4ba72f4d.json)).
Signal zero delivers no signal. These observations show no permission
bypass for the tested target and call shape. They do not prove how
Sony implemented number 481, that every target is protected, or that
a nonzero signal has the same behavior.
