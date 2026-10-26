# Syscall-601 pointer gates on the retail PS4 reporting 14.00

These are WebProcess calls through a wrapper and native caller measured on
the live page. All completed captures are pinned and verified. Successful
return codes below do not establish a sandbox escape or kernel mutation.

## Request 1 first word

An absent name at input offset `0x28` was held constant while the first
32-bit word changed. The input buffer and its guard were checked after
each call. Three bounded runs tested `2, 3, 4, 8, 16, 32`, then
`0x40, 0x48, 0x50, 0x80, 0x100, 0x400`, then `0x1000, 0x4000, 0x5000,
0x10000, 0xffffffff`. All 17 calls returned `-1/EINVAL`, changed zero
input bytes, and preserved the guard and PID. Captures:
[first group](../captures/c8c376a223ba4d2c95c34698b77e2c12.json),
[second group](../captures/2086d536a89c49da9d8b8d8a9498f01b.json),
[third group](../captures/f855c9744f144300b4d743b0c5c04d5a.json).
This closes these first-word values with this specific absent-name shape;
it does not identify the request-1 layout.

## Null-pointer request shapes

Request 31 previously returned `EFAULT` with null remaining arguments.
On the current page, replacing only argument 2 with a readable 256-byte
buffer returned `EFAULT` both when filled with `0xa5`
([capture](../captures/7703f767368041caa5f203ea4af98dfc.json))
and when zeroed
([capture](../captures/689445430f1a4a8fadaf2109b96d66d7.json)).
Neither call changed that buffer or its guard.

With a separate readable zeroed buffer in argument 3, request 31 changed
to `-1/EPERM`. It changed no owned bytes, preserved PID 71, and left the
measured `is_in_sandbox,is_development_mode` tuple at `1,0`
([capture](../captures/0d339b4f19d1423791bcd6d8e8775a47.json)).
This is an argument-sensitive authority gate, not proof of what the
request would do for an authorized process. Later pointer-position arms
in that command were intentionally skipped after the first changed
return.

With readable zeroed buffers in arguments 2 and 3, request 14 returned
`0`. Neither buffer changed, its guard held, PID remained 71, and the
same authority tuple stayed `1,0`
([capture](../captures/97f330f51f5e48a69112727d8c020e33.json)).
The command stopped after this first successful selector, so it did not
test 17, 18, 26, or 28.

The subsequent pinned command `9369092472ae410b8fdbf8e3cd15ff6e`
sent before-call markers for 17, 18, 26, and 28 in that order, then
stopped reporting after `mdbg_pair_before_28`. There is no submitted
return capture for any arm in that command. The markers show that control
reached the next arm after calls 17, 18, and 26, but do not establish
their return codes or buffer results. The operator subsequently reported
a system-memory warning followed by a refreshed browser page. The
command remains claimed without a return capture, and the new page has
a different session ID. Do not replay the claimed command or interpret
the warning as a specific kernel fault.

On the separately calibrated next page, PID 72, a bounded two-pointer
repeat obtained the missing results without calling request 28:
requests 17 and 18 each returned `EINVAL`; request 26 returned zero.
Neither owned buffer changed; guards, PID, and the `1,0` sandbox/development
tuple held ([verified capture](../captures/637a0de8cae4433987cf8c717e255b71.json)).
Another command called 14 and 26 separately with the same two-pointer
shape. Both returned zero with no owned-byte change, and the request-0
status remained `0x100` before and after each call
([verified capture](../captures/84734c04545f441db03ee945bdd826b1.json)).
These outcomes close the missing return-code gap for these exact shapes;
they do not explain request 28's warning or imply an authority change.

The two completed pointer-gate results identify 14.00 dispatch branches
worth understanding, but neither changes a protected-resource outcome.
Further work requires a source-backed argument contract or an independent
state readback; repeating the successful request-14 shape or the
request-31 `EPERM` shape would add little information.
