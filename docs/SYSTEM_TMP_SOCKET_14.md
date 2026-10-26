# 14.00 browser-visible local service sockets

The current browser session `2119cf8f1a734dc5a6b964e8c2b1d3fb`
(PID 74) read its own `/system_tmp` directory through byte-checked
number-196 `getdirentries` and an owned output buffer. The
[verified census](../captures/e3b7e8792dca43e9800eeb7ca0388cf8.json)
returned 176 bytes, parsed to `.`, `..`, `mdbg0_dbgp`,
`GnmCompositor`, `GnmCompositorRestricted`, `gpvdec_arbitrator`,
`gpvdec_proxy`, and `gpvenc_proxy`. The directory descriptor closed and
the frame was restored. `SceKernelDescPassing` was absent, consistent
with the [separate VideoCore check](VIDEOCORE_CLIENT_14.md).

The native-call installer v33 located and byte-checked syscall
wrappers 97 (`socket`), 98 (`connect`), and 196 on this page
([capture](../captures/32ae5668e94546f0a1d605e241c6cb5b.json)).
A matched AF_UNIX/SOCK_STREAM connection check sent **no protocol
payload** and closed every descriptor:

| Socket path under `/system_tmp` | `connect` | Browser errno |
| --- | ---: | ---: |
| `Fw14NoSuchSocket` control | -1 | 2 (`ENOENT`) |
| `mdbg0_dbgp` | -1 | 1 (`EPERM`) |
| `GnmCompositor` | -1 | 1 (`EPERM`) |
| `GnmCompositorRestricted` | 0 | 0 |
| `gpvdec_arbitrator` | -1 | 1 (`EPERM`) |
| `gpvdec_proxy` | 0 | 0 |
| `gpvenc_proxy` | -1 | 1 (`EPERM`) |

The [completed comparison](../captures/9dcfd9f7330845448bf9cc901f917e76.json)
also returned the original PID, restored the owned frame, and left the
page polling. A prior source-pinned run reached all markers through the
restricted compositor but its ninth synchronous marker exceeded the
collector quota before a result; it is not counted as an outcome
([claim `e524f26a`](../captures/88927a19d40149469944df381fabe300.json)).
The two remaining video-socket comparisons also completed with the same
nonexistent-path control, cleanup, and restoration
([capture](../captures/a406f6802c1145199ef2ba4bde3a2b74.json)).

The restrictive/unrestricted compositor names have different observed
connection permission on this browser process. A successful connect
establishes only that a socket accepted the browser; no message was
sent, no credential or protected resource changed, and the server's
identity, command format, and authorization checks remain unknown.
Only the browser-side client images were dumped, not these servers.
An exact ASCII scan of all 78 captured RX/RO/RW segments found no
`GnmCompositorRestricted`, `gpvdec_proxy`, `GnmCompositor`, or `gpvdec`
literal. Their protocol clients may reside elsewhere, construct names
dynamically, or not be used by this browser. The dump alone therefore
does not identify a message format for those two connected sockets.

## Peer-credential readback

A current-page installer added and byte-checked the live number-118
`getsockopt` wrapper before the [read-only peer-credential check](../captures/3fdb83fcd96d408a9d0144c28bd80d4f.json).
Both accessible sockets connected again. With level `0`, option `1`,
and an owned 64-byte output, each returned zero and began with the same
32 bytes:

`0000000000000000010000000000000000000000000000000000000000000000`

The caller closed both descriptors, restored its frame, and verified the
same browser PID. An owned socketpair control returned `-1`, errno `57`,
and left its sentinel unchanged, so it did **not** independently
calibrate the output structure. In upstream FreeBSD 9's Unix-socket
handler, level `0` and option `1` select `LOCAL_PEERCRED`; its `xucred`
layout puts
version `0`, effective UID, and group count at offsets `0`, `4`, and `8`.
Under that layout these bytes mean version `0`, peer UID `0`, one group.
This is a useful **14.00 peer-credential lead**, but Sony's exact output
layout and the two server identities still need independent validation.
Even a root-owned peer socket would not confer its privileges on the
browser: a controlled server request and observable unauthorized effect
would be needed to establish an escape.

Upstream implementation and layout references: [FreeBSD 9 Unix-socket handler](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/kern/uipc_usrreq.c),
[FreeBSD 9 `un.h`](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/un.h),
[FreeBSD 9 `ucred.h`](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/ucred.h).

## Connection lifetime and calibration controls

The live-map-relative native-call installer v37 byte-checked the 14.00
`unlink`, `bind`, and `listen` wrappers and passed its four-PID control
([capture](../captures/97aa850fc10e4499834a861da0fae1b9.json)).
An owned Unix-socket control could not bind under `/system_tmp`:
`-1/EACCES (13)`. The listener closed and the frame restored; since bind
never succeeded, no socket pathname was created
([capture](../captures/3096fc983b544da7a494e457d47acc0d.json)).
The matched `/tmp` attempt returned `-1/ENOENT (2)` and likewise closed
cleanly ([capture](../captures/3ed0406100424e6e907bc24e9d739a75.json)).
Neither run supplied a known-UID peer credential. The first probe version
only reported a missing published wrapper; a subsequent probe returned
invalid detail count, so neither is used as a socket result.

The v38 installer added a byte-checked number-29 `recvfrom` wrapper
([capture](../captures/8440b39ec5634117825f50445e02419d.json)).
With upstream `MSG_DONTWAIT=0x80`, an absent-path control again returned
`ENOENT`. Both successful connections returned **zero bytes immediately**
from a nonblocking read, with no outgoing payload. The same exact probe
repeated this result independently on new descriptors:
[first capture](../captures/9a01937f74ec440c9a0cf073035431ae.json),
[repeat](../captures/e3edd4598255466b86a6b9f80ce53691.json).
All descriptors closed and the browser frame restored. For stream sockets,
zero from `recvfrom` indicates end-of-stream, unlike the expected
`EAGAIN` when a connected peer remains open but has no data. These two
endpoints accept the browser connection then close it in the tested
no-payload flow. The peer-credential bytes remain a service-identity
lead, but neither socket currently supplies a usable request channel.
Do not rank them ahead of the live IPMI and routing channels without a
different 14.00 mechanism that keeps the connection open.

The flag definition is from [FreeBSD 9 `socket.h`](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/socket.h).
