# 14.00 VideoCore browser client boundary check

The full browser-process [SPRX capture](FULL_SPRX_DUMP_14.md) includes
`libSceVideoCoreServerInterface.sprx` (handle 61). Its executable mapping
has SHA-256 recorded in the full manifest. The live import-link report
resolves four candidate thunks from this module into `libSceIpmi`.

At RX offsets `0x3d00-0x3e5b`, the captured client code constructs an
AF_UNIX (`1`) sequence-packet (`5`) socket, copies the literal
`/system_tmp/SceKernelDescPassing` into a `sockaddr_un`, and calls the
current process's number-98 connect wrapper. An analysis-only ELF built
from the verified mappings gave the same path and socket flow in the
[focused Ghidra output](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/videocore_functions.txt).
That ELF is a loader aid, not an original Sony SPRX. The linked number-97 and
number-98 wrappers contain the matching syscall instructions in the
captured `libkernel_web.sprx` image. This is a static client-code path;
it does not establish that a server is running.

The page-local installer v32 independently found and byte-checked the
number-98 wrapper along with the existing number-97 and native-call
plan. [Installer capture](../captures/3b8fabcb8cb943d1a132e01da32a8998.json).
The [matched live socket check](../captures/53de0e73c38449459bb3170744c676a6.json)
then opened two owned descriptors and closed each cleanly:

| Path | `socket` | `connect` | `errno` | `close` |
| --- | ---: | ---: | ---: | ---: |
| `/system_tmp/Fw14NoSuchSocket` | 9 | -1 | 2 (`ENOENT`) | 0 |
| `/system_tmp/SceKernelDescPassing` | 9 | -1 | 2 (`ENOENT`) | 0 |

The browser page and its owned frame were restored. This exact socket
endpoint is absent in the tested state; no descriptor passed and no
sandbox boundary changed. The IPMI service string `SceVideoCoreServer`
is a separate lead. Its existence, client permissions, and method
contract are not established by the Unix-socket result.

## Separate `SceVideoCoreServer` IPMI gate

The same complete 14.00 image imports four `libSceIpmi` entrypoints.
Its [focused initializer decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/videocore_ipmi_init.txt)
creates a client named `SceVideoCoreServerInterface`, embeds the
`SceVideoCoreServer` name, and attempts a server connection before
calling the IPMI client's `connect` vtable entry with a four-byte
request and separate result fields. That call is part of connection
setup, not a read-only service method. Its
[caller](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/videocore_ipmi_caller.txt)
is a VideoCore event-processing loop. The server implementation and
authorization checks are absent from the browser dump.

The current page's [v47 native caller](../captures/4832e74e853041eabde17e4f315eec28.json)
validated the exact IPMI create/config/destroy entry bytes and the
number-622 wrapper against live module mappings. A first owned-client
connect reached both markers but its result was rejected by the
collector because it had 13 detail fields; it supports no return-value
claim ([rejected capture](../captures/b9c9ccda544d49598bdfb422817305ab.json)).

The corrected [single-connect result](../captures/ed8d57c124b44736ae803e0f99cb955c.json)
used a client named `SceVideoCoreServer`, sent no server method or
payload, and reported:

| Measurement | Result |
| --- | --- |
| Raw number-622 connect syscall | `0` (transport completed) |
| Connect result word | `0x80dc0001` |
| Session-PID query | `-1/ESRCH`, no peer PID |
| Disconnect attempt | `-1` with zero result word |
| Owned-client destroy | `0` |
| Browser state | PID 74 and scratch restored; page continued polling |

The zero syscall return is **not** a successful server session: the
separate result word and failed peer query show no connected session
under this generic client configuration. The exact meaning of
`0x80dc0001` is not established here. A successful official VideoCore
initializer would use a larger source-defined arena/configuration, so
this result does not prove the named server is globally unavailable.
No descriptor, method output, or privileged effect was obtained.

## Existing module-owned client is connected

The generic client's failed connection does not describe the module's
already initialized client. A [guarded read of the module singleton](../captures/1609cb845896405095a8445c12e470d9.json)
found its arena, server pointer, and client pointer populated, with the
run flag set. A separate [read-only peer query](../captures/74aac59ec72243689cefb31aa85a5968.json)
checked that client's vtable in the live IPMI image, obtained its client
ID (`9767`), and used the number-622 session-PID query. The transport and
result word both returned `0`; the reported peer was PID `46` while the
browser was PID `74`. The probe did not disconnect, destroy, or send a
request through the module-owned client. The browser remained connected
and its scratch state was restored.

This confirms a second live cross-process IPC session on 14.00. The
captured initializer names `SceVideoCoreServer`, so that service is the
source-supported interpretation of the peer, but PID `46` has not been
independently identified. The [event-loop decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/videocore_ipmi_caller.txt)
shows receive calls for queues `0` through `6` and local callback dispatch.
It does not by itself supply an outbound privileged method contract.
No sandbox escape or protected-resource result follows from the
connection alone.

## Source-defined outbound request

The [14.00 wrapper decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/videocore_wrapper_range.txt)
contains request IDs `0x12340000` through `0x12340039`, each sent through
the IPMI client's vtable `+0x58`. They are individual client contracts;
their presence alone does not establish server permission. Request
`0x12340017` is the only wrapper in this family with zero input entries
and one four-byte output entry. The complete function-offset/request
[map](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/videocore_request_map.json)
is reproducible with [the parser](../tools/map_videocore_requests.py).

The [v48 installer](../captures/ecad8673e0124786bcb51c682294bca4.json)
checked that wrapper's current-map first 16 bytes. The
[guarded live call](../captures/29c5c3df5e01492db7729114c3e16f8a.json)
through the module-owned client returned `0`, wrote `1`, preserved its
output guard, restored scratch and pointer state, and left the page
polling. This is a working cross-process service method. The meaning of
output `1` is not yet established; no protected resource or privilege
change has been demonstrated.

A later [matched raw-IPMI calibration](IPMI_RAW_METHOD_ABI_14.md)
showed this four-byte output changing on successive calls: official
wrapper values `3`, `4`, and `6`, with raw-packet values `5` and `7`.
The original `1` therefore is not a stable Boolean capability marker.
The method continues to return successfully through the module-owned
client, but its service-side meaning remains unknown.

The [browser-adapter import callsites](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/requirements_videocore_callers.txt)
link ten VideoCore entries into `libSceNKWebKitRequirements`. Their
[focused decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/requirements_videocore_selected.txt)
contains source-side names for setting VideoCore initialization info,
creating/deleting a media stream, reading play status, and changing
display size. This makes the working service a credible browser media
dependency. The imported callsites do not show a process-launch,
credential, jail-state, or kernel-memory request. That lowers this
client's priority for the sandbox-escape goal unless a distinct method
or malformed request produces an independently observed boundary effect.

## Media-contract scope correction

The captured normal caller constructs an exact `0x9f8`-byte stream
description. It places the stream name at `+0x00`, the URI at `+0x20`,
the media type at `+0x820`, the codec string at `+0x8a0`, and the user
agent at `+0x971`. Its fixed fields include `+0x930 = 1`,
`+0x960 = 0xffffffff`, `+0x968 = 400`, and `+0x970 = 0`.

The create wrapper at VideoCore RX `+0x8f20` rejects a null description,
a null output pointer, or any nonzero byte at `+0x970` with
`0x80dc0001`. The normal media path therefore does **not** exercise the
descriptor-related branch. Testing `+0x970 = 1` or improvising a
descriptor-passing call would not reproduce the source-defined browser
contract and is excluded from this phase.

This interface is best understood as the browser's ordinary media
service. A hidden DOM `<video>` could cause normal media activity, but it
would not distinguish direct service access from ordinary Web content.
The remaining bounded check instead supplies a unique URL only to the
native `0x9f8` create request, then calls play-status and delete. A
collector request for that URL is the independent oracle. A normal
successful stream remains a media-path result, not a sandbox escape.

## Bounded media-contract result

On 2026-10-24, session
`5839ba27e08d49e9bff06e1f951ec718`, PID `73`, rebuilt the module map
and installed byte-checked wrappers for create (RX `+0x8f20`), delete
(`+0x9480`), and play-status (`+0x99f0`). The one bounded call used the
source-defined `0x9f8` layout, kept `+0x970 = 0`, and supplied unique
URL token `9763a36724a54560929cee90309faa9c`. The DOM never received that
URL.

The service returned `0` from create, produced handle `1`, returned `0`
from play-status, and returned `0` from delete. The first 32 status
bytes were zero. Structure guards, scratch memory, and the post-call PID
control all restored
([device capture](../captures/01680cb86e7e483b8d3eff71ec9516ee.json)).
The collector served a valid H.264/AAC MP4 fixture but received no HEAD,
GET, or range request for the token before or after cleanup
([oracle record](../evidence/live/videocore_oracle/9763a36724a54560929cee90309faa9c-result.json)).

This is an accepted create/status/delete lifecycle without an observed
transport request. It produced no protected-resource access,
authorization change, descriptor transfer, process launch, or other
boundary effect. The exact contract is exhausted and the VideoCore
branch is closed for this phase. A new VideoCore test would require a
different source-defined method plus an independent unauthorized-effect
oracle; the rejected `+0x970` branch remains excluded.
