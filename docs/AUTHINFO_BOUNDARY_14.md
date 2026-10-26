# Process auth-info boundary on PS4 14.00

On the live 2026-10-23 browser page, the byte-checked syscall-587 wrapper
returned a 136-byte record for the browser and for other existing PIDs.
This is a read-only interface observation. It did not grant process-record
access, alter credentials, or cross the browser sandbox.

The page measured its own PID as `62` and parent as `38`; neither number is
used as a reusable address or hardcoded into a probe. The guarded
`587(pid, output)` calls returned `0` and filled 136 bytes for both PIDs.
For the browser, the first two 64-bit words were
`0x3800000010000011` and `0x2000000000000000`; for the parent they were
`0` and `0x4000000000000000`.
[Verified capture](../captures/657ca63cb64b49a59d1f0910986cb797.json),
SHA-256 `3ec7000ea95972325361ac15af053c4be3929b6931eded0b221b62314d830a14`.

The zero-PID selector returned exactly the same 136 bytes as the explicit
self PID. An absent PID returned `ESRCH` with no output change.
[Selector capture](../captures/d822270d988146c9aa80dcfc834588a1.json),
SHA-256 `188de13a1b46ef3772cb88817134e675cdaa4f60680f12245303884de33070dd`;
[exact self/zero comparison](../captures/42c3633076cc409fa20b51e0d8939a8d.json),
SHA-256 `fe83727eb433f270880e17296d92427617703e79c2009c0167c4529332a65796`.

A bounded PID-1-through-64 census returned a 136-byte record for 62 of
64 selectors; 37 and 64 were absent at that instant. Fifty-six first-word
pairs matched the parent's `0`/`0x4000000000000000` pattern. PIDs 49 and
50 instead had `0`/`0x1000000000000000`; PIDs 58 and 59 had
`0`/`0x2000000000000000`. PID 61 had
`0x3800000010000012`/`0x2000000000000000`, and PID 62 was the browser
pattern above. The census recorded only the first 16 bytes per successful
record; its compact output does not establish every field for every PID.
[Verified census](../captures/bf28a5f822814c63b41d1eac7238b05f.json),
SHA-256 `e079e6a9784d17b5cce93cd6f9cad7490a3cfc15cc9cfb34dfe40bb70abad33d`.
The public 0x88-byte `self_auth_info` layout gives a historical field
interpretation for these two words, but the Sony 14.00 kernel implementation
has not been inspected. [Layout source](https://github.com/SiSTR0/ps4-hen-vtx/blob/master/kpayload/include/self_helper.h).

The distinct PID-61 auth pattern did **not** relax the process-inspection
gate. A fresh page-local calculation chose the preceding PID and called
`sysctl(KERN_PROC_PID, 61)` size-only; it returned `EPERM`, as did the
matched parent-PID query. Both output guards and the native-call state
restored. [Verified comparison](../captures/4cfd84a98c9248a6b0fb2b7a8a420dfe.json),
SHA-256 `534c856c35e0f5ca805f267e65d964aaa3d97043d3c6b3084ba8f70746dfdf1e`.
This separates a limited auth-info read from permission to inspect a
process record. A 136-byte record with many zero bytes may be a deliberately
reduced projection; the kernel-side rule is unknown.

The separately byte-checked syscall-607 path was tried with the browser's
live path, obtained through `sysctl(KERN_PROC_PATHNAME, self PID)`:
`/SV7V606Nzy/common/lib/NKWebProcess.self`. It returned `EACCES` and
left the guarded output unchanged. The same path with a nonexistent suffix
returned `ENOENT` and also left output unchanged.
[Verified path comparison](../captures/c5892e19c85f4925b327c18d6c92bb8b.json),
SHA-256 `85f8046118a65fb11a40378c0dd4bf65e92a233c4199f5efd1fc8daa799144b4`.
The public name `get_self_auth_info` is only a label for this call shape;
these returns establish a path-sensitive permission gate, not the complete
14.00 contract.

Four captured modules bind both verified wrappers: Sysmodule, IPMI,
SystemService, and VideoOut. A hash-checked static direct-call scan found
32 calls to the 587 thunk and four to the 607 thunk **per module**. These
repetitive callsites prepare 0x88-byte stack output; examples compare the
first 64-bit program identifier to fixed values, read capability words,
or extract an attribute bit. They are a caller index, not evidence of a new privilege route or
execution of every callsite. [Static index](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/auth_syscall_callers.json),
[reproducible scanner](../tools/trace_auth_callers.py).

One Sysmodule helper at RX+`0x39b0` checks bit 62 of the record's first
capability word after calling 587. Eleven direct Sysmodule callsites first
call their own PID getter and pass that PID into this helper; its branch
selects different local setting-read paths in the initializer. The
browser's captured first capability word has bit 61 set and bit 62 clear,
whereas the parent record has bit 62 set. This is a concrete consumer of
the record, but the module's current callsites inspect **their own** PID;
there is no evidence that another PID's record changes browser authority.

The initializer's bit-62 branch selects a source-defined RegMgr read of
key `0x7802c000` through Sysmodule RX+`0x54e0`: syscall 532 command `2`,
the key, an output-status pointer, an output-value pointer, and size `4`.
The guarded direct 14.00 call returned `-1/EPERM` and changed neither
output word. The source-shaped read was rejected at the syscall boundary,
so merely changing this browser-local auth-bit branch would not make this
setting available. [Verified key capture](../captures/13b9de0332204b99b46da7f1e22ac1c8.json),
SHA-256 `01fca5ec02d57f1ddc4e290246911d6349c2336267f67328ca9ae1b7650fba6f`.
The matched browser-side fallback at Sysmodule RX+`0xe59` reads key
`0x1ac46343411b3f40` through command `0x19`. Its transport returned
`0`, but the RegMgr status word was `0x800d0203` and the value remained
zero. Thus neither side of this specific source branch supplied a usable
setting. [Verified fallback capture](../captures/32cdbf24ea35438085532533ece3249b.json),
SHA-256 `10f6bfe8d18744cb73e7012e0f652e8e6a096cafbacecb150c980cd3d6f5a474`.

**Decision:** do not expand the PID census or treat an auth-info record as
an escape. Resume this branch only if a 14.00 source-defined action uses
one of these bits in a way that has an independently measurable protected
effect. The current sandbox-escape and kernel milestones remain open.
