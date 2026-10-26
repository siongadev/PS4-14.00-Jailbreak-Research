# Routing-socket boundary on retail PS4 14.00

This is a direct device test of a network/kernel input path, not a claim
that Sony shipped an upstream FreeBSD vulnerability. The [FreeBSD route
advisory](https://lists.freebsd.org/archives/freebsd-security/2026-February/000422.html)
describes an oversized `RTAX_AUTHOR` address overflowing a 128-byte
temporary buffer during `RTM_GET` reply construction. The [upstream
fix](https://github.com/freebsd/freebsd-src/commit/1eb2beb3686c)
checks the address length before that copy; the buffer-copy path itself
was introduced by an [earlier FreeBSD change](https://github.com/freebsd/freebsd-src/commit/92be2847e845ba90e4da028cfd7f5a8013919f90).
Sony's 14.00 kernel source and instruction path are not available here.

All captures below came from one connected 14.00 page session
`6780d62a1b2e41f7a4758525a146c534`, PID `71`. Its native caller
located and byte-checked the current number-97 `socket` wrapper in
[v29](../captures/380f7014411540f8a62e79a1362251c3.json) and the
number-209 `poll` wrapper in
[v30](../captures/b059479d35b34b5bba6139aea80b2c63.json).
Addresses were measured on this page only.

| Device check | Result |
| --- | --- |
| [Socket-family gate](../captures/7eb63587f21747b7881f23943db0483c.json) | `socket(17, 3, 0)` opened descriptor `9` and closed with `0`. An ordinary Internet stream socket also opened/closed, while family `255` failed with errno `43`. The historical `AF_ROUTE=17`, `SOCK_RAW=3` interpretation is supported by the subsequent message exchange. |
| [Read-only `RTM_GET` gate](../captures/cdf3d4f6c8af42ef8f0cfdfb661b2f1d.json) | A FreeBSD-shaped message for `127.0.0.1` with version `5`, type `4`, and one destination address wrote all 168 bytes. Changing only version to `4` returned `-1/43`. Both sockets closed. |
| [Reply readback](../captures/8e79b82c611742fd91b93c1081f3c7aa.json) | The valid write returned `168`; a bounded poll reported readable; read returned a 224-byte reply with version `5`, type `4`, and the current PID `71` in its header. Output guards and close passed. |
| [`RTAX_AUTHOR` controls](../captures/3df799305add4766b825246ce962b393.json) | Author lengths `16` and `24` wrote 184 and 192 bytes and returned 240- and 248-byte replies, respectively. The response tail retained each author length. |
| [Storage-boundary length](../captures/4cc9c8ecb0b14659a07ed8b44a297eb4.json) | Author length `128` wrote 296 bytes, returned a 352-byte reply, and closed cleanly. |
| [First length beyond 128](../captures/217047791c634733be2913bcc2cdbc6e.json) | Author length `129` wrote 304 bytes after eight-byte padding, returned a 360-byte reply retaining `sa_len=129`, and closed cleanly. |
| [Published oversized length](../captures/68ab98b27f714ef39e618928a6ffb5ac.json) | Author length `255` wrote 424 bytes after padding, returned a 480-byte reply retaining `sa_len=255`, and closed cleanly. The page continued polling. |
| [Full IPv4 reply](../captures/b36509f93c9046cf9753bbe1b46e5555.json) | The ordinary lookup returned 224 bytes. Its route header, IPv4 destination, and link-layer gateway contain no unexplained pointer-shaped field in this one sample. |
| [IPv6 loopback reply](../captures/f7440d78ad6e4f4d8204fcde87063e07.json) | A 184-byte `::1` request returned a 240-byte reply. Its 28-byte IPv6 destination had four zero alignment bytes. |
| [IPv4 interface-address reply](../captures/d40553e5ef694326a3e8060434438a7e.json) | Requesting interface and interface-address fields returned 296 bytes: the expected loopback link-layer and IPv4 addresses, with no unexplained nonzero tail. |
| [IPv6 interface-address reply](../captures/26026e5e617944de8aa71fbb08a3b9a5.json) | The corresponding IPv6 request returned 328 bytes. Both the destination and kernel-selected interface IPv6 address were followed by four zero alignment bytes. |
| [`RTF_ANNOUNCE` IPv4 control](../captures/d85927f56c074be692e5d0111de9b490.json) | Setting only flag `0x4000` on the ordinary IPv4 lookup changed the returned route from the unflagged control; the 168-byte write and 192-byte reply completed cleanly. |
| [`RTF_ANNOUNCE` IPv6 comparison](../captures/90554397936647918e8be6af1b83cfb4.json) | Setting the same flag on the successful `::1` lookup wrote 184 bytes and returned the same 240-byte reply as its unflagged control. Both before/after-write markers, read, guard, and close completed. |

The [original researchers](https://www.praetorian.com/blog/llm-kernel-exploit-development/)
identify `RTAX_AUTHOR` length `255` as the upstream overflow trigger.
Our 14.00 request reached a route reply that preserved this length, but
it did not produce a memory warning, kernel panic, unauthorized state
change, or read/write primitive. This is consistent with Sony either
using a different serializer or validating/copying differently. It
cannot prove the entire routing-socket implementation safe or patched.
The [older FreeBSD routing source](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/net/rtsock.c)
copies aligned sockaddr lengths into replies, so address padding is a
specific byte-level check worth making. These four captured replies did
not reveal unexpected nonzero padding; zero bytes in a few samples do
not establish the Sony serializer's implementation or rule out every
information leak.
There is a separate source-backed reason to compare that flag: the
[older FreeBSD `RTM_GET` path](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/net/rtsock.c)
uses a 16-byte `struct sockaddr` temporary in its `RTF_ANNOUNCE`
branch, while [`rt_maskedcopy`](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/net/route.c)
copies the source address's length, which can be 28 bytes for IPv6.
The [current upstream implementation](https://github.com/freebsd/freebsd-src/blob/main/sys/net/rtsock.c)
uses `sockaddr_storage`. Our 14.00 IPv4 result shows the flag can affect
lookup, but the IPv6 test showed no interruption or abnormal reply. It
does not reveal which Sony implementation is present or establish a
kernel overwrite. Repeating the identical `::1` input has no strong
outcome discriminator beyond a possible interruption.
The most useful result is a reproducible, unprivileged, two-way kernel
message surface on the current firmware. Further work should target a
specific Sony 14.00 differential behavior, with a valid readback and
one changed field per test; repeatedly sending the same oversized
author field would add no information.

## Route-table write boundary

On 2026-10-24, a separate connected page session
`5839ba27e08d49e9bff06e1f951ec718`, PID `73`, tested the write side of
this interface. The page first repeated the ordinary `RTM_GET` control:
the 168-byte request returned a 224-byte version-5/type-4 reply, with
poll/read, guard restoration, and descriptor cleanup all passing
([control capture](../captures/e375328380774aff8383d74d041ee2e9.json)).

The bounded mutation then used route socket A to request one `RTM_ADD`
for TEST-NET `198.51.100.0/24` via `127.0.0.1`, with
`RTF_UP | RTF_GATEWAY`. Route socket B independently queried
`198.51.100.1` before and after the call. The add returned `-1` with
errno `1` (`EPERM`). Socket B never observed the exact destination,
gateway, and mask; its replies continued to describe the existing
default route through `192.168.1.1`. No delete was required. Both
descriptors closed, the process ID stayed `73`, and the owned-frame
guard was intact
([verified mutation capture](../captures/9adfe8cb3a694cf8bd187814dcedc4ca.json)).

This closes route-table write authority for that exact, validly framed
`RTM_ADD` shape. It does not prove every routing-message mutation is
impossible, but it removes the only current route-table change with an
independent state oracle. The route socket remains a confirmed readback
surface; it has not produced a sandbox escape, kernel read/write, or an
unauthorized system-wide effect.
