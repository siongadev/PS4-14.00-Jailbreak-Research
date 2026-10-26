# PS4 firmware 14.00 research progress

Updated 2026-10-24. This table uses only observations from the retail console reporting firmware 14.00. Source-code explanations are hypotheses until the running browser binary is identified. [Sony's current PS4 WebKit source listing](https://www.playstation.com/en-us/oss/ps4/webkit/) has no distinct 14.00 archive; its newest label is open-ended at “13.00 -”, which does not establish a binary match. [Source provenance](../references/README.md).

| Milestone | Current status |
|---|---|
| Browser memory corruption and process read/write | **Demonstrated on 14.00**, with fresh-page repeats. |
| WebKit-process native execution | **Demonstrated on 14.00** through a restored native code-reuse chain and syscall calls. |
| Syscall and IPC interface map | **All 26 loaded modules structurally mapped; selected interfaces tested.** The import graph resolves 186 direct fixed-wrapper bindings and the live routing socket accepts a parsed read-only lookup. A validly framed `RTM_ADD` was rejected with `EPERM`, and an independent route socket observed no table change. Client semantics and privileged server code remain incomplete. No unauthorized effect is established. |
| Browser sandbox escape | **Not demonstrated.** |
| Kernel memory read/write or kernel execution | **Not demonstrated.** The former syscall-638 “kernel base” interpretation has been withdrawn. |

**Phase closeout (2026-10-24):** The browser-stage primitive and native
code-reuse execution are demonstrated. The best remaining state-changing
routing test was run once: `RTM_ADD` for TEST-NET
`198.51.100.0/24` via `127.0.0.1` returned `-1/EPERM`; a second route
socket observed no exact route before or after, both descriptors closed,
and the page guard stayed intact. This closes that exact route-table
authority shape and does not establish a sandbox escape
([control and mutation record](ROUTE_SOCKET_14.md)). Numeric wrapper IDs
are 14.00 observations; syscall names and argument meanings inherited
from older public tables remain hypotheses unless current callsites and
live behavior validate them ([scope correction](SYSCALL_NAMES_14.md)).
The final VideoCore media contract was also exhausted once: its exact
create/status/delete lifecycle returned cleanly and restored all guards,
but the unique non-DOM URL never reached the collector and no protected
effect occurred. That service branch is closed for this phase.

The [full WebProcess mapping capture](FULL_WEBPROCESS_DUMP_14.md) completed
**167,526,400 of 167,542,784 read-permitted bytes** across 128 mappings;
one 16 KiB RW mapping triggered a memory warning even on a one-byte read.
All 28 RX mappings are complete. Twenty-six match the prior full SPRX
archive by size and SHA-256; the main executable and a small fixed-syscall
page are the other two. Their scan found no additional canonical
fixed-number wrapper for the native installer's 30 `sys_missing` numbers.
That narrows the browser-entry inventory; it does not measure the kernel's
entire syscall table.
The [full-dump reverse pass](FULL_WEBPROCESS_REVERSE_14.md) also resolves
the main executable's 66 live import bindings and a gated startup path
that passes `FMEMSizeLimit` through fixed wrappers 194/195 with resource
selector 10. A fresh 14.00 page then returned a **1,536 MiB soft limit**
and a FreeBSD-style infinite hard limit through the byte-checked fixed-194
wrapper. The read-only call returned 0 and restored its frame; it does not
prove that the startup setter ran or explain every system-memory warning.
On that same page, a second read-only check counted 143 VM mappings totaling
**284.98 MiB**, about 1,251 MiB below the reported soft limit at that
instant. This ordinary-page snapshot does not capture a transient failure.

The [2026-10-24 boundary checks](OCT24_BOUNDARY_14.md) added a
source-defined SystemService termination request, two idempotent RegMgr
write gates, and bounded syscall-674/675 shapes. The service request
returned the same `0x8094000F` denial as other LNC methods; RegMgr's
service status was `0x800d0214` with unchanged readback; 674/675 returned
`EINVAL`/`EPERM`. A duplicate AIO delete in one batch returned first
success then `ESRCH`. None changed authority or read kernel memory.

The [same-day composition tests](CHAIN_COMPOSITION_14.md) combined
confirmed 14.00 operations instead of treating isolated success codes as
an exploit chain. A pending AIO read stayed with its original socket
after its numeric descriptor was reused. A NamedObj handle passed through
debug init did not change the debug-service request or status. In 192
serial AIO write-then-delete attempts, deletion was busy until completion
and every request cleaned up. A SystemService kill request using the live
app-status ID received the same denial as an absent-ID control, with
unchanged status and PID. These tests have not advanced the sandbox-escape
or kernel-memory milestones.

The [concurrent AIO delete tests](AIO_14.md) use two browser threads
and independent result buffers. One of seven single-request zero-pause
runs returned two per-ID successes; the other six returned one winner.
Eleven two-request and twenty-two three-request MULTI-object runs all returned
one winner and left their sibling requests completed and removable. After
one browser reopen, the lifecycle probe ran once and then repeated twenty
times in the same WebProcess; all twenty-one attempts had one winner. A
post-delete 666 call returned per-ID `ESRCH`, which is expected after an
ordinary deletion and does not distinguish two internal frees. The older
published double-free requires a multi-request object, so the lone
single-request result remains an unreproduced output anomaly, not evidence
of kernel read/write or a sandbox escape. The exact 558/`0x160` call
returned `ESRCH` for completed and pending AIO IDs, but no positive
`0x160` control or object-family link was established; this rules out only
that call shape, not a generic AIO handle-deletion mechanism.

An [anonymous mapping comparison](EXEC_MAP_GATE_14.md) returned
page-aligned addresses for RW, RX, and RWX requests on 14.00. A later
VM-map check queried those pages while held: effective protections were
`3`, `1`, and `3` respectively, so the execute bit was stripped even
from accepted RX and RWX requests. The attempted owned-code call ended
in a memory warning and page refresh; generated-code execution is
**not demonstrated**. The established WebKit-process native execution
milestone above rests on independently repeated code-reuse calls.
A byte-checked number-74 `mprotect` test then denied both RW→RX and
RW→RWX with `EACCES`; both pages stayed RW. The ordinary anonymous
page route tested here is closed by direct 14.00 evidence.
The separate number-379 `mtypeprotect` four-argument shape returned
errno 45 for RX and RWX transitions; both owned pages stayed RW. Its
full 14.00 contract is still unknown.
The matched RW→RW control returned the same errno 45, so the tested
four-argument shape is not validated as the real ABI.

**AIO branch (2026-10-23):** A source-shaped call through 14.00 wrapper
669 completed one- and two-request reads from `/dev/random`, with IDs,
result states, poll, delete, and descriptor cleanup. Sequential deletion
of the same ID returned per-ID `0x80020003`; its sibling was later
deleted. A pending one-byte socketpair read reached a marker before
wrapper 663 and then the console became unresponsive. **663 is AIO wait,
not cancel**: the probe passed a null timeout while the read had no data.
The run is consistent with an unbounded wait and is not a demonstrated
kernel bug or privilege effect. After reboot, the next run needs a
completed-request **666 cancel** control and a separate socket
submit/write/poll/delete control.
[Exact probes, captures, and limits](AIO_14.md).

Those fresh-page controls passed: 666 returned on both completed and
processing requests, the processing socket read completed after a peer
write, and a 10,000-usec 663 wait returned `ETIMEDOUT` before the read
was unblocked. Every request was deleted and its descriptors closed.
The AIO branch has reached live kernel work queues but has not shown a
privilege crossing or a memory-safety failure. [Captures](AIO_14.md).
Deleting the socket request during processing returned per-ID
`0x80020010` (`EBUSY`), both before and after a 666 cancel call;
completion then allowed deletion. That closes the simple processing
delete path on this page. [Matched captures](AIO_14.md).

**Auth-info boundary (2026-10-23):** On a live 14.00 browser page,
syscall 587 returned 136-byte auth records for the browser and existing
other PIDs. A bounded census found several distinct record prefixes,
including a browser-neighbor pattern. A matched process-record query for
that neighbor and the browser parent still returned `EPERM`. The
path-shaped syscall-607 call returned `EACCES` for the browser's own SELF
path and `ENOENT` for a nonexistent path. These are useful permission
boundaries, not an authority change. [Exact captures and static caller
map](AUTHINFO_BOUNDARY_14.md).
The Sysmodule branch controlled by one of those bits selects a fixed
RegMgr key; a source-shaped direct read of that key returned `EPERM`
with untouched output, confirming the browser-side branch alone does
not make the key readable. The matched browser fallback returned
RegMgr status `0x800d0203` with no setting value.

The separate `/dev/dce` read-only shared-map reachability check returned
`EACCES` after its anonymous-map control passed. This joins the earlier
`/dev/dmem0` `EPERM` map result; neither tested device satisfies the
device-pager advisory's mapping prerequisite. [Device gate](DEVICE_PAGER_GATE_14.md).

**LNC status-read gate (2026-10-23):** The source-matched 24-byte output
descriptor stride let three fresh-page methods reach the live LNC
service. ShellUI-reboot list `0x3002f`, local list `0x3000f`, and GPU
crash status `0x30030` all returned method code `0x8094000F`, with no
status entries or protected data. The earlier malformed list packets
returned `EINVAL` before the service method. This branch has a working
transport and a measured denial, not an escape.
[Probe layouts and captures](LNC_SHELLUI_REBOOT_LIST_14.md).

**IPMI packet calibration (2026-10-23):** Reversing the complete live
`libSceIpmi` image identified the synchronous method's 48-byte raw
request layout. The older hand-built LNC request differed from Sony's
wrapper in its final control word. A corrected raw request to the
already-connected VideoCore client returned success; its output advanced
by one after the official wrapper call. A separate corrected raw LNC
`0x30013` request returned the **same 12 app-status bytes** as the
official SystemService wrapper, with result words zero and full
restoration. Changing only the last packet word from `1` to `0` on that
same live LNC method reproduced `-1/ESRCH` and untouched output; the
capture arrived, but that page did not poll again. The operator was asleep
and later found the console off; the immediate on-screen state is unknown,
and the later shutdown cannot be attributed to this probe. This explains the old malformed request's
failed method result, while any relation to the old console failure
remains unresolved. The corrected packet
validates method transport on two live services, not an authorization
bypass. The changing VideoCore value is not a stable
Boolean capability marker. [ABI, exact captures, and limits](IPMI_RAW_METHOD_ABI_14.md).

The raw-IPMI/LNC freezes, browser losses, console shutdowns, and
CE-36329-3 report are retained as a separate **availability lead**. They
are operator-observed system-level failures with temporal association to
malformed or hand-built IPC. Without a kernel log, serial trace, Error
History attribution, or faulting instruction, they are not proven kernel
panics and do not count as sandbox-escape, kernel-read/write, or kernel-
execution results. The corrected official-client calls returning cleanly
make raw marshaling the strongest differential, while leaving the failing
component unknown.

**Mbus and AvSetting clients (2026-10-23):** The 14.00 Mbus initializer
created a live `SceMbusIpc` client (state `2`), but its checked
zero-input/output-buffer method returned `0x809b00ff` with zeroed output.
The AvSetting initializer returned `0x809a00ff` and left state `0`; its
residual pointer cannot be used as a connected client. No authority
effect was observed. [Exact source and verified captures](MBUS_AVSETTING_CLIENTS_14.md).

**Cross-module syscall screen (2026-10-23):** All 26 hash-checked RX
images were scanned for literal `0f 05` pairs. Only `libkernel_web`
contains the canonical fixed-number wrapper sequence (302 sites); the
apparent `syscall; ret` in ICU is inside a lookup table. No new direct
syscall gateway emerged from this screen. [Method and limits](ALL_MODULE_SYSCALL_SCAN_14.md).

**All-module wrapper import map (2026-10-23):** A separate byte- and
slot-checked correlation covers every loaded module and identifies 186
direct links into ordinary `libkernel_web` wrappers. Its strongest new
source relationship is a number-649 module-parameter query in
`libSceSysmodule`. A guarded live call returned its own RW parameter
pointer; a separate readback found size `0x20` and SDK `0x14008001`.
That is a useful local information path, not a sandbox crossing.
[Per-module numbers, slots, and captures](ALL_MODULE_KERNEL_IMPORTS_14.md).

**Sysmodule fixed-ID table (2026-10-23):** All 310 records were decoded
from the hash-checked 14.00 module image. The table's
`libSceUserService` ID `0x80000011` was passed to the source-defined
loader with zero optional arguments; it returned `0x80020002` and the
before/after module handle set was unchanged. A matched read-only open
of its source-derived retail path returned `ENOENT`. This did not add a new
browser-side client. [Table, method, and live captures](SYSMODULE_CLIENT_14.md).

**All-module path screen (2026-10-23):** Every loaded module's RX/RO
image was rehashed and searched for path-shaped literals. The 95
source locations include SystemService timezone reads, Net debug
capture paths, and known device nodes; they do not introduce a new
live privileged broker or an authorization effect.
[Exact module, segment, and offsets](ALL_MODULE_PATH_SCREEN_14.md).

**VideoCore IPMI discriminator (2026-10-23):** The separately mapped
`SceVideoCoreServer` client was tested after the distinct
`/system_tmp/SceKernelDescPassing` endpoint returned `ENOENT`. A
byte-checked, owned generic IPMI client
failed to form a session (`0x80dc0001`), but a guarded read of the
module's existing client found a live connection. Its read-only
session-PID query returned peer PID 46 while the browser was PID 74.
The module's source-defined output-only request `0x12340017` then
returned `0` and wrote `1` through that existing session, with guarded
output and full restoration. Its semantic meaning remains unresolved;
it is not evidence of a sandbox escape.
[Source and captures](VIDEOCORE_CLIENT_14.md).

The ordinary media caller initializes a `0x9f8` stream structure with
`+0x970 = 0`. The create entry itself rejects nonzero `+0x970`, while
the only direct descriptor-manager starter observed in that function is
on the rejected branch. Descriptor passing is therefore not an
established reachable sub-path. VideoCore remains a live browser-media
service contract, not a demonstrated privileged capability.

The final bounded media contract was run once on PID `73` with the exact
`0x9f8` structure, `+0x970 = 0`, and a unique URL never given to the DOM.
Create returned `0` with handle `1`, play-status returned `0` with an
all-zero first 32 bytes, delete returned `0`, and all guards restored.
The independent collector received no request for the token. This is an
accepted service-object lifecycle without a transport or protected
effect, so the VideoCore branch is closed for this phase
([capture and oracle record](VIDEOCORE_CLIENT_14.md)).

**VideoOut device gate (2026-10-23):** The complete 14.00
`libSceVideoOut.sprx` image exposes a `/dev/dce` ioctl protocol, but its
captured browser-side DCE handle was `-1`. A checked initializer then
opened the node; one source-shaped, output-only request returned
`EPERM` without writing data, and its descriptor was closed/reset. Four
source-matched, output-only `/dev/dipsw` ioctls all returned success and
zero values through owned, guarded buffers, with descriptor cleanup and
the page still polling. This maps a working device read path, not an
authority change. [Exact client and live captures](VIDEOOUT_DEVICE_GATE_14.md).

**NetCtl broker gate (2026-10-23):** A new analysis of the complete
14.00 `libSceNetCtl.sprx` image located its initialized `SceNetCtl`
IPMI client and a zero-input, four-byte-output method (`0x20004`). A
byte-checked live call returned success and wrote `3`; the matched
null-output control returned `0x80412107` without writing. Both kept
the browser responsive and restored native state. This establishes a
working read-only broker path, not a sandbox escape or protected-resource
read. [Exact 14.00 record](NETCTL_CLIENT_14.md).

The six other NetCtl output-only methods returned the same
`0x804121a1` status and zeroed their guarded outputs, so this exact
family yielded no further data. [Method family captures](NETCTL_CLIENT_14.md).

**14.00 libkernel map (2026-10-23):** The browser loads
`libkernel_web.sprx`, not a module named `libkernel.sprx`. Its 344 KiB RX
image contains 293 fixed-number ordinary syscall wrappers; a second
session's complete number list matches exactly. Nine other fixed-number
syscall sites include one literal `syscall; ret` at RX `+0x2c89a`, inside
a number-454 routine. `libSceLibcInternal.sprx` and `libSceNet.sprx` are
also loaded. The verified bases, full number/offset catalog, import-link
graph, working capabilities, and limits are in the
[libkernel map](LIBKERNEL_WEB_MAP_14.md). Focused decompilation shows
several commonly imported entries are status translators or pthread
mutex helpers rather than additional syscall gateways. A generic syscall-number call
from that `syscall; ret` site remains unproven; a prior matched
mismatched-site call on 14.00 stopped with the browser memory warning.
A fresh native AF_INET/TCP control connected to the PC collector and a
second socket wrote an 86-byte canary; both restored the browser. The
already verified HTTP bulk uploader remains the proven module-dump path.
The four-argument module loader returned `ENOENT` for both bare and
`/system/common/lib` paths to `libkernel.sprx`; the captured Sysmodule
client's literal `libc.sprx` path returned the same result. No new module
handle appeared, so file visibility versus loader policy remains unresolved.

**Full 14.00 browser image and new boundary map (2026-10-23):** All 26
loaded SPRX modules were captured across 78 RX/RO/RW mappings (106.67 MiB),
with exact coverage and per-segment hashes. A resolved import-link graph
connects the browser's WebKit, graphics, SystemService, IPMI, and syscall
clients. [Manifest and limits](FULL_SPRX_DUMP_14.md). A live `/system_tmp`
directory census found six service sockets. `GnmCompositorRestricted`
and `gpvdec_proxy` accepted a browser connection, while `mdbg0_dbgp`,
`GnmCompositor`, `gpvdec_arbitrator`, and `gpvenc_proxy` returned `EPERM`;
each descriptor closed and no protocol data was sent.
[Captures](SYSTEM_TMP_SOCKET_14.md). Reversing the SlimGL client found a
caller-supplied render-server path reaching
`sceSystemServiceAddLocalProcess`, but this converges on the previously
denied LNC launch route, with no observed process launch.
[Client trace and limits](SLIMGL_CLIENT_14.md).
On the two accessible sockets, a read-only peer-credential request
returned identical bytes consistent with a version-zero, UID-zero
`xucred` under the upstream FreeBSD layout. The owned socketpair control
could not calibrate that structure, and neither socket has received a
protocol request. [Raw 14.00 readback and limits](SYSTEM_TMP_SOCKET_14.md).
Two source-pinned nonblocking reads then returned immediate stream EOF
on fresh connections to both sockets, twice. They accept the browser's
connect call but close without a request. Browser-owned pathname
calibration could not proceed because `/system_tmp` denied bind and
`/tmp` was absent. The sockets are now lower priority than working IPMI
and routing channels.

**Syscall 637 reassessment (2026-10-23):** The historical
`set_phys_fmem_limit` name suggested a self-target call. Verified 14.00 captures
already show argument-sensitive success, but no limit readback or
authority change. The older "selector/output buffer" interpretation is
likely wrong: the successful second-argument buffer address may have
been accepted as a large numeric limit. A direct PS4 14.00
`637(0, 0xffffffff)` call now returned zero with the measured authority
tuple unchanged. We also found the two-output `615(pid, out1, out2)`
resident-memory readback; both values rose by 128 after touching 2 MiB.
This measures usage, not a 637 limit or a sandbox escape.
[Evidence and correction](SYSCALL_637_14.md).

**Latest sandbox-boundary discriminator (2026-10-23):** A fresh IPMI
client connected to `SceSysCoreApp`; two read-only getter shapes and an
app-info query through byte-checked live client code returned
`0x80AA000B` with no app data. A matched unconnected client returned
`0x80020003` and left its output sentinel untouched. This proves a
distinct connected method path but no privileged action. The public
LNC error table also labels the repeated launch/list error
`0x8094000F` as `NOT_ALLOWED`, consistent with that service gate.
[SysCore captures and limits](SYSCORE_APP_CLIENT_14.md),
[LNC attribution](SYSTEM_SERVICE_IMAGE_14.md).
The adjacent SysCore getter also returned `0x80AA000B` on 14.00. A
separate live-image-derived `SceShellCoreUtil` connect stopped inside
the connect step on two page sessions; both produced an operator-observed
memory warning and no return capture. Neither result demonstrates a
service connection or sandbox crossing. [Exact markers and limits](SYSCORE_APP_CLIENT_14.md).
The corrected [batch-map layout control](BATCH_MAP_14.md) returned
`EINVAL` for an owned read-only protection entry at the published
operation offset, while count zero returned normally without writing
an output.
The guarded number-646 kernel-statistics read returned `EPERM` with no
output or guard change ([gate](KERNEL_STATS_GATE_14.md)).
The current [evidence snapshot](../evidence/2026-10-23-kstats-gate.zip)
contains 1,537 captures, 1,329 pinned probe sources, and 44 live
artifacts; all 2,911 manifest entries and the SQLite backup verified
(SHA-256 `7f480dbd8e79f6e39ace18336858293d8baf7c049e920fa06eaa10a4a3f8a9d3`).

**Latest boundary result (2026-10-22):** On a freshly calibrated 14.00
page, the live number-432 wrapper wrote the browser thread ID to an owned
buffer. A bounded number-481 signal-zero scan then located a thread ID
associated with the browser's parent process. Two independent calls
against that parent PID and thread ID returned `EPERM`; a wrong-thread
control returned `ESRCH`, while the browser's own thread returned success.
No signal was delivered and no sandbox crossing was observed. The result
closes this tested target and signal-zero shape, not every possible
signal or Sony kernel implementation. [Exact captures and limits](THR_SIGNAL_ZERO_14.md).
The same page required a new 4 MiB History-layout gate and a second
anchor-groom batch before its native caller could be rebuilt. All
addresses were measured on that page; none were carried across a refresh.
[Calibration record](SESSION_CALIBRATION_14.md).
An additional historical number-572 virtual-query shape returned
`EINVAL` for a mapped owned address and null control, then again for
four output sizes and a next-mapping flag. It produced no kernel mapping
readback. [14.00 query record](VM_QUERY_GATE_14.md).
Number 624 returned a nondecreasing sequence that sometimes repeated
across calls and varied little with its first argument. That behavior
fits the historical VM-map timestamp name better than the earlier
“new object ID” interpretation; the exact update cause is not isolated.
[Direct 14.00 sequence](VM_TIMESTAMP_14.md).
The [routing-socket study](ROUTE_SOCKET_14.md) established a two-way
kernel message channel on 14.00: an ordinary `RTM_GET` returned a
224-byte reply, and author lengths 16, 24, 128, 129, and 255 all
returned length-matched replies with cleanup. The 255-byte shape that
triggers an [upstream FreeBSD stack overflow](https://lists.freebsd.org/archives/freebsd-security/2026-February/000422.html)
did not interrupt this console. The upstream bug is therefore not
demonstrated on Sony 14.00, though the reachable route parser is a
concrete surface for firmware-specific follow-up.
Full IPv4 and IPv6 route replies, including requests for kernel-selected
interface addresses, returned normally. The IPv6 sockaddr alignment
bytes captured in those replies were zero; this test did not expose an
unexpected kernel byte or pointer. [Byte-level captures](ROUTE_SOCKET_14.md).
An `RTF_ANNOUNCE` comparison changed the IPv4 route lookup but returned
normally for the same IPv6 loopback route used in its control. This did
not reproduce the older upstream source's potential short-temporary
address-copy concern on the tested 14.00 request.
A byte-checked anonymous `mmap`/`munmap` control also passed, while a
read-only map of the browser-visible `/dev/dmem0` node returned `EPERM`.
This closes the tested unmanaged-device-pager prerequisite on that node.
[Device mapping capture](DEVICE_PAGER_GATE_14.md).
The read-only wrapper census now covers the complete **344 KiB RX
mapping** containing the live number-20 syscall wrapper. It found the
same 293 wrappers as the earlier 12 KiB scan, with none outside that
window; candidate numbers `221`, `222`, `510`, `518`, and `571` are absent
from this measured mapping. This does not establish their absence from
other modules or from the kernel. All 12 nonstandard `syscall` byte sites
in the mapping were also recorded; none showed a variable-number gateway.
[Full mapping capture](SANDBOX_WRAPPER_CENSUS_14.md).
Syscall-601 request 0 returned an exact eight-byte `0x100` output on an
owned buffer. That output did not change after request 4 or nine other
successful selectors; its meaning remains unidentified. Request 2 returned
ENOSYS. [Request-0 status record](MDBG_REQUEST0_STATUS_14.md). A live
parent-PID `KERN_PROC_VMMAP` size query returned `EPERM`, while the
browser's own query returned its expected size. [Boundary capture](PARENT_VMMAP_GATE_14.md).
Further 14.00 request-1 first-word checks all returned `EINVAL` for 17
sampled values. Supplying two owned pointers changed request 31 from
`EFAULT` to `EPERM` and request 14 from `EFAULT` to success without
observed output or sandbox-indicator change. A later request-28 comparison
stopped after its before-call marker; the operator reported a memory
warning and browser refresh. It has no return capture.
[Pointer-gate evidence](MDBG_POINTER_GATES_14.md).
A read-only KTLS prerequisite query resolved its known-name control but
returned `ENOENT` for `kern.ipc.tls.enable`; the upstream KTLS receive
issue has no measured 14.00 entry from this browser. [KTLS gate](KTLS_GATE_14.md).

**2026-10-22 live update:** On a fresh 14.00 page, the new number-610
argument/output matrix repeated a return value of `2` for first argument
`0xffffffff` and detected no owned-buffer change. Its matched number-619
matrix returned ENOSYS for all 16 shapes, including `0xffffffff`; the
earlier 619 “2” statement rested on a truncated brute-force row and is
withdrawn. A 601 selector sweep reached the before-call marker for
selector 8, after 5–7 returned control to JavaScript, then the operator
observed a frozen browser. A second fresh-page sweep reached selector
12 after 9–11 returned control, then polling stopped before a result;
the browser displayed a “page is not responding” prompt and then a
memory warning after the operator stopped it. Selector 27 separately
produced a memory warning after its before-call marker. These
interruptions have no captured return or demonstrated kernel effect.
The [new request map](MDBG_REQUEST_MAP_14.md) records the selector
returns and nine owned-buffer/authority checks. [Brute-force
correction](SYSCALL_BRUTE_14.md) and [selector interruption record](MDBG_SELECTOR_14.md).

On the next connected 14.00 page, request 4 also returned `0` for four
arg2/arg3 pointer and size shapes without changing either owned buffer.
Request 1 returned `EINVAL` for ten isolated input-field shapes with an
absent name. Neither check established an object update or changed the
browser boundary. The [request map](MDBG_REQUEST_MAP_14.md) links exact
captures. The [number-548 batch-map and number-547 mapped-address
checks](BATCH_MAP_14.md) returned `EINVAL` without output for the tested
shapes; their 14.00 record/argument contracts remain unresolved. The
per-page native setup now retries an empty first anchor-groom batch,
while retaining the probe's four-batch cap.
The first null-argument number-668 check stopped after its before-call
marker; the operator saw a memory warning and refreshed page. No AIO
return or kernel effect was captured. [AIO record](AIO_GATE_14.md).

**Earlier 2026-10-22 checkpoint:** a **111-wrapper custom-syscall census** and NamedObj create/delete study established 557-created handles with `(generation << 13) | slot` layout and rejection of a one-generation stale handle by 558 (captures `b835442c` and `3045868d`). That result closes the tested stale-handle variant only. The newer 14.00 kind-gate capture proves a separate `0x4000` lookup class, which the older study did not test. The name-limit probes varied arg2 and string length together, so they do not establish arg2 as a length parameter. Syscall 661's malformed calls ended the WebProcess without a diagnosed cause; 624's changing values are not object IDs merely because they change. [NamedObj record](NAMEDOBJ_14.md), [brute-force follow-up](SYSCALL_BRUTE_14.md).

**Correction from the 2026-10-22 brute-force capture:** syscall 601 returned 0 for request value 4, and syscall 595 returned 0 for module handle 16. A later same-PID 592 comparison confirmed that 595 removed browser module handle 16; a 601 request-4 before/after check found no change in sandbox, development-mode, or sandbox-path results. The former P2 pointer-domain interpretation of 601 and 615 is withdrawn: historical ABI evidence identifies arg1 as a 601 request code and a 615 PID, respectively. The 624 changing values are not demonstrated object IDs. The former syscall-638 kernel-base claim is also withdrawn after a six-hour time-conversion match. [Brute-force follow-up](SYSCALL_BRUTE_14.md), [corrected 638 record](KBASE_CONSTANCY_14.md) and [corrected P2 record](REPORT_P2_DRAFT.md).

**Current discriminator (2026-10-22):** Two syscall-601 selector-3 calls,
one with an owned zero buffer and one with null, stopped after their
before-call markers. The operator observed a memory warning both times;
no return or kernel error signature was captured. Selector 3 is retired
pending a different oracle. A read-only check in the second process
found the ProcParam high word at zero before the warning. A fresh
read-only 14.00 repeat found `0x14008001` at `+0x10` and zero at
`+0x14`; this matches the SDK-version slot in public ProcParam layouts
and our separate live SDK query. The former “memory-field” interpretation
is withdrawn. The `0xffffffff` capture proves a userland write/readback
and eight successful MiB of allocation, not an unlimited budget; its
`still_max` flag checked the wrong word. [Selector evidence](MDBG_SELECTOR_14.md),
[field correction](PROCPARAM_MEMORY_14.md).

**Offline boundary check:** The live 14.00 SysCore RX and fresh-boot RW
images show that simply forcing the local app-context flag would pass a
guard but hand a null client to the IPC dispatcher. The instruction and
pointer bytes were hash-checked; no device mutation was attempted.
[SysCore client record](SYSCORE_APP_CLIENT_14.md).

A bounded [upstream advisory screen](ADVISORY_SCREEN_2026-10-22.md)
found no new kernel issue with its specific prerequisite established in
this 14.00 browser. The advisory descriptions are hypotheses only, not
evidence that Sony shipped those bugs.

**Latest evidence archive:** [`2026-10-23-ipmi-map-v13.zip`](../evidence/2026-10-23-ipmi-map-v13.zip), SHA-256 `e5201421a2dcf3119d120a249af4f87b2ba66c5039bc1ca6d655930507eee438`. Its 1,849 captures, 1,527 pinned probe snapshots, 27,563 live artifacts, 30,940 manifest entries, and SQLite backup passed archive verification. The prior [`2026-10-23-ipmi-abi-v12.zip`](../evidence/2026-10-23-ipmi-abi-v12.zip) remains preserved.

**Formal report drafts (2026-10-22):** [P1 — browser chain and corrected 638 interpretation](REPORT_P1_DRAFT.md) · [P2 — corrected syscall ABI and census](REPORT_P2_DRAFT.md) · [P3 — ProcParam, malformed AIO call, and IPC behavior](REPORT_P3_DRAFT.md) · [Raw-IPC system failures and official-client comparison](REPORT_KERNEL_PANIC_DRAFT.md). The 595/601 device follow-up is captured in [SYSCALL_BRUTE_14.md](SYSCALL_BRUTE_14.md).

**Evidence-strength check:** browser-process read/write and native code-reuse execution are directly observed and fresh-page repeated. Number 638 was previously misread as a kernel-address disclosure. Its three tested outputs each equal the input minus 21,600 seconds, matching the historical `utc_to_localtime` name; the claimed kernel-base derivation is withdrawn. The 601/615 first-argument comparisons were misread as pointer-domain tests; their historical contracts instead use a request code and PID, so the earlier missing-validation hypothesis is withdrawn. CE-36329-3 accompanies operator-observed system-level failures after raw IPC probes but does not identify the faulting component. These are important research leads, not completed kernel read/write, sandbox escape, or kernel code execution.

**Prior checkpoint (2026-10-21):** Browser-process read/write and WebKit native code reuse have been reproduced on firmware 14.00. The page can call measured native wrappers from two browser threads. A direct self-path query, complete 32 KiB launcher RX-map capture, and 27-entry live module inventory identify the browser process. A complete 245,760-byte live `libSceSystemService` RX capture now ties an app-status callsite to this running process. A byte-checked native call to that read-only interface returned success and 12 output bytes through the service client. A 49,152-byte live `libSceIpmi` RX entry is also preserved; byte-checked client create/destroy and same-process client-name queries returned normally. A raw `ipmimgr_call` connect to `SceSysCoreApp` then returned success, and a session-PID query returned **38**, the browser's parent; the session was explicitly disconnected and destroyed. No server method was invoked, so this demonstrates a reachable cross-process IPC channel, **not** an unauthorized action or sandbox escape. The credential and parent-process denials remain intact; nine native-chain close/reuse comparisons produced only replacement registration or no event. On 2026-10-21 the console stopped immediately after a `SceLncService` sync-method attempt returned `ESRCH`; the restart reported CE-36329-3 (system software error). The loaded `libSceSysCore` client and its sync-method ranges are now analyzed offline; a five-input spawn-shaped method `0xaa110003` is identified but has not been called. After the operator-observed console stop, `SceSysCoreApp` yielded no session and a session-only `SceSysCoreApp2` connect coincided with a memory warning. Error History held no entries. After a full power cycle, the official first-path getter and app-info getter each returned `0x80AA000B` cleanly, making the hand-built raw marshaling the leading differential without proving the earlier failure's cause; the App2 app-init gate stays unreachable and the spawn stays gated. No protected-resource access, kernel-memory effect, sandbox escape, or kernel exploit has been demonstrated. [Service image and IPC](SYSTEM_SERVICE_IMAGE_14.md), [IPMI image](IPMI_IMAGE_14.md), [boundary model](PROCESS_BOUNDARY_MODEL_14.md), [next device run](NEXT_SANDBOX_RUN_14.md).

| Stage | Status |
| --- | --- |
| Confirm 14.00 environment | Done. System Information was checked by the operator; the collected browser user agent reports `PlayStation 4/14.00`. |
| Preserve exact device evidence | Done for the current snapshot. [`evidence/2026-10-22-app2-esrch.zip`](../evidence/2026-10-22-app2-esrch.zip) contains 1,184 captures, 1,012 pinned probe blobs, 42 live artifacts, and a SQLite backup; all 2,239 manifest entries verified (SHA-256 `2df19073b584441df42af19a00314e3a5372168c4ec49d6202d21b064e62523b`). It includes the App2 discriminator v2–v11 attempts and the clean ESRCH result capture. The earlier [`2026-10-22-app2-discriminator.zip`](../evidence/2026-10-22-app2-discriminator.zip) (1,149 captures, 995 probe blobs, 2,187 manifest entries, SHA-256 `0f29d92426097f0cef6f9ed36faa1c2bd6f61db8c79b78f41d1050d58cc3ac66`) remains as the pre-ESRCH snapshot; the earlier [`2026-10-22-device-probes.zip`](../evidence/2026-10-22-device-probes.zip) (1,134 captures, 985 probe blobs, 2,162 manifest entries, SHA-256 `92ca4139e07840a8b65044000a5d76e871e031895fe3d6c20dd653200c1ed119`), [`2026-10-22-namedobj-gen-repeat.zip`](../evidence/2026-10-22-namedobj-gen-repeat.zip) (1,127 captures, 973 probe blobs, 2,143 manifest entries, SHA-256 `7cc3e44247fc5ee5e1cffad566546cfe85f7ac2b01e43f82168160116892f23e`), and [`2026-10-22-namedobj-661.zip`](../evidence/2026-10-22-namedobj-661.zip) (1,117 captures, 971 probe blobs, 2,131 manifest entries, SHA-256 `9637286c9af296c55828612d2206d26602a81fa9c70633a8e9114e13417c78e8`) remain as earlier snapshots; the [`2026-10-21-syscore-freshboot.zip`](../evidence/2026-10-21-syscore-freshboot.zip) (839 captures, SHA-256 `c5b9cb7432c245d23b5dfb717fd418da73a776ed1b4b05416c741c32d4a75b30`) is superseded. New device runs require a new snapshot. |
| Establish browser controls | Done. Ordinary History clone controls and fresh-page repeats distinguish the trigger from baseline behavior. |
| Identify a native-memory bug | Done. A History-deserialization mismatch creates a forged typed-array view. |
| Out-of-bounds read/write | Demonstrated at one byte beyond an eight-byte resizable buffer, twice on fresh page sessions. [Evidence and limits](HISTORY_NATIVE_OOB_14.md). |
| Controlled neighboring allocation | Done. A forged view read and wrote the separately cloned `filler[2]` buffer; the write and restore repeated on a fresh page. [Evidence](HISTORY_NEIGHBOR_RW_14.md). |
| Address-directed read/write among cloned buffers | Done for eight selected resizable-buffer backing stores at measured 65,536-byte intervals, including a write and restore to the eighth. |
| Read/write into a different allocation class | **Confirmed on a fresh page:** a forged view over a resizable buffer changed and restored a byte in a live cloned **fixed** `ArrayBuffer` in two sessions, with the same probe source hash. [Evidence and limits](HISTORY_FIXED_BUFFER_RW_14.md). |
| Controlled freed-slot reuse | Repeated: after detaching the fixed buffer with an unreturned transfer, a new fixed buffer reused its measured slot; its bytes were read and changed through the forged view. [Evidence](HISTORY_SLOT_REUSE_14.md). |
| Native pointer disclosure and bounded write | **Fresh-page repeated through the two-slot probe:** a write to a retained node-list vector made `item(0)` return node 1; restoration made it return node 0. Earlier single-slot variants were intermittent. [Evidence](HISTORY_NATIVE_POINTER_RW_14.md). |
| Live JavaScript-value storage read/write | **Fresh-page repeated.** A forged view saw adjacent eight-byte JSArray element slots change for object A/B assignments. Writing an observed B word through the view made `array[0]` become B; restoring A's word restored object identity and its marker. A third command disclosed distinct words for a new object and live `Math.expm1`, then restored the slot. [Evidence and limits](HISTORY_JSARRAY_STORAGE_14.md). |
| Address-calibrated object read/write | **Fresh-page repeated.** A leaked object word and its live property index yielded a page-aligned forged-view base of `0x200df0000` in two sessions. Each run predicted a separately allocated object's property index from its word, changed that property through the forged view, and restored it. A separate direct-write check also repeated on a fresh page. [Evidence](HISTORY_ADDRESS_DIRECTED_RW_14.md). |
| Newly allocated function-cell read | Done on one page. The calibrated view read 64 bytes at each of two leaked live function-object words, 64 bytes apart; both functions still called normally. [Evidence](HISTORY_ADDRESS_DIRECTED_RW_14.md). |
| Existing built-in call-target redirection | **Fresh-page repeated.** The forged view replaced a bound `Math.expm1` function's observed target word with the live `Math.log1p` word. The same bound call returned the `log1p` result, then its original `expm1` result after all bytes were restored. The repeat recalibrated a different view base. [Evidence](HISTORY_BOUND_CALL_TARGET_14.md). |
| Two-slot pointer correlation | **Fresh-page repeated:** a temporary fragment-node vector in one measured slot contained a word exactly matching the first pointer of a separately controlled, live element list in another slot. The preceding word is a source-backed text-node pointer candidate. [Evidence](HISTORY_NATIVE_POINTER_RW_14.md). |
| Cross-type native pointer substitution | **Fresh-page repeated.** In a separately gated command, inserting the leaked text-node pointer into the live list made `item(0)` return the exact Text node (`nodeType === 3`, `nodeName === "#text"`). Original bytes and behavior were restored in both sessions. [Evidence](HISTORY_NATIVE_POINTER_RW_14.md). |
| Native lifetime effect | **Single matched observation; repeat pending.** After list finalization, a detached Text wrapper retained its original data in the unchanged-list control but returned an empty string when its pointer had replaced a list entry. The source predicts an extra `deref()` of that Text node. Polling later stopped, so a follow-up reuse check has not run. [Evidence](HISTORY_NATIVE_POINTER_RW_14.md). |
| Same-type Element lifetime branch | Prepared, not run. A matched control and duplicate-pointer arm use the already validated first-to-second list swap, then separate list finalization from a potentially stale span read. [Run criteria](HISTORY_ELEMENT_DUPLICATE_14.md). |
| Historical 14.00 browser code-reuse execution | The old project recorded a number-20 native call and 14.00 gadget-byte checks. This project has now revalidated the candidate bytes in live code and independently rebuilt and repeated that call path; old heap layouts and absolute addresses were not carried across. [Gadget provenance](VALIDATED_GADGETS_14.md). |
| Absolute address calibration for the forged view | **Passed across fresh pages with different bases.** A leaked object's numeric property gave a page-aligned view base, and a separate object's address predicted a reversible property write. The later native-call repeat measured `0x200ff0000` instead of the first call's `0x200e34000`; its anchor and typed-array cells were checked again. [Evidence](HISTORY_ADDRESS_DIRECTED_RW_14.md), [native-call repeat](HISTORY_NATIVE_CALL_14.md). |
| Address-directed process read/write | **Passed.** Reversibly changing an owned typed array's observed data pointer redirected ordinary reads to another owned buffer, then reached a live native executable-metadata object and mapped WebKit code below the original forged-view base. Native writes remained restricted to measured, restored targets. [Evidence](HISTORY_NATIVE_READ_14.md). |
| Current-process WebKit code and gadget validation | **Passed on two browser pages.** A live function-code pointer yielded a page-aligned WebKit base; all 15 candidate gadget signatures and the number-20 wrapper matched current-process bytes. The second page recalculated a different WebKit base. [Evidence](HISTORY_NATIVE_READ_14.md), [repeat plan](HISTORY_NATIVE_CALL_14.md). |
| Independent WebKit code execution in this project | **Passed and fresh-page repeated.** A bounded native code-reuse chain called the current-process number-20 wrapper, changing an initially zeroed owned frame to `140`, then `141` on a new page. Both calls returned and restored the function slot, pivot cell, typed-array pointer, and ordinary `Math.expm1` result; the operator saw no warning. [Evidence](HISTORY_NATIVE_CALL_14.md). |
| Browser sandbox identity | **Passed for UID.** A separate byte-checked native call returned UID `1` into an owned sentinel-filled frame, then restored its chain and browser pointers. This identifies one process credential, not its complete policy. [Evidence](SANDBOX_BOUNDARY_14.md). |
| Named sandbox-state call | **Returned `1` on 14.00.** The live number-585 wrapper was byte-checked, called once, and all modified state restored. An older PS4 SDK calls it `is_in_sandbox`; exact 14.00 kernel semantics remain uninspected. [Capture and limits](SANDBOX_BOUNDARY_14.md). |
| Targeted-thread signal interface | **Non-delivery control passed on 14.00.** The live number-481 wrapper was located and byte-checked, then a zero-signal call against nonexistent PID/TID returned `ESRCH` with browser state restored. A FreeBSD permission-check advisory supplies a hypothesis, but no unauthorized signal or sandbox crossing was attempted or observed. [Capture and limits](SANDBOX_BOUNDARY_14.md). |
| Reachable event-queue interface | **Ordinary open/close passed.** Current-process 14.00 number-362 and number-363 wrapper bytes matched twice. Number 362 opened fd `9`; a separate owned one-argument call through number 6 closed it with return `0`. Both calls restored browser pointers and owned state. [Captures and limits](SANDBOX_BOUNDARY_14.md). |
| Independent worker-side native call | **Passed twice in this project on 14.00.** A fresh worker transport, transferred-buffer anchor, eight-slot object-shape scan, and worker-owned read established the worker bridge. The worker's own `Math.expm1` slot and pivot object were measured live; a bounded number-20 call returned PID `145` into an owned frame. A second call with a separate, byte-verified store/pivot/stack/frame also returned PID `145`. Both calls produced preflight and restoration markers. [Evidence and limits](SANDBOX_WORKER_PATH_14.md). |
| Worker native wait with page progress | **Passed on 14.00.** A byte-checked number-240 wrapper returned zero after 300 ms on the worker's independent plan; the page's 50 ms timer fired before the worker's return timestamp, and all modified state restored. [Capture and source](SANDBOX_WORKER_PATH_14.md). |
| Concurrent native calls on two browser threads | **Passed twice on 14.00.** A page-side number-20 call returned PID `145` 52–53 ms into the worker's 300 ms native sleep. Both worker and page plans restored in each timestamped capture. This is a concurrency control, not a sandbox escape or event-queue race result. [Captures and source](SANDBOX_WORKER_PATH_14.md). |
| Event-queue user-event control | **Passed on 14.00 in this project.** A guarded page-side number-363 sequence added and triggered a user event, read one matching 32-byte record without changing the 32-byte guard, then deleted the event and closed queue fd `9`. [Capture and source](SANDBOX_WORKER_PATH_14.md). |
| Worker event wait/wake | **Passed twice on 14.00.** The worker's independent plan waited in number 363 with a two-second timeout; the page triggered the registered event after 50 ms. Both runs returned one matching event at about 52 ms with intact output guards, restored pointers and buffers, and successful queue deletion/close. This is ordinary concurrent event behavior, not a registration/close race result. [Captures and source](SANDBOX_WORKER_PATH_14.md). |
| Worker two-call native continuation | **Passed twice on 14.00.** One worker chain waited for the owned user event, then called the byte-checked number-20 wrapper before returning to JavaScript. Both runs returned one event and PID `145` with intact guards and full restoration. [Captures and source](SANDBOX_WORKER_PATH_14.md). |
| Worker wake-then-fd registration | **Passed twice on 14.00.** The worker's second number-363 call registered an owned socket read fd before returning to JavaScript. The page wrote through its peer and received one matching `EVFILT_READ` event; all guards and cleanup passed. This establishes the call shape but contains no concurrent close. [Captures and source](SANDBOX_WORKER_PATH_14.md). |
| First registration/close scheduling comparison | **Completed but missed the overlap gate.** The worker returned register `0`; the page then closed the old fd and opened a replacement at the same number. Neither separately written source signaled, and cleanup passed. The recorded close began after the worker returned, so this says nothing about the kernel's narrow race interval. [Capture and next gate](FD_REGISTRATION_RACE_14.md). |
| Native-chain registration/close comparison | **Nine bounded runs completed on 14.00.** A page-side native chain woke the worker, closed the watched fd, and reopened its number. Three runs produced replacement-only readiness; six produced no event. The last four captured worker errno: successful registrations returned `0`, failed registrations returned `EBADF` (`9`). None showed an old-source event or proved the kernel's narrow overlap interval. All had exact reuse and cleanup. [Captures and limits](FD_REGISTRATION_RACE_14.md). |
| FD-backed socket readiness | **Passed on 14.00.** An owned socketpair's read fd `10` was registered with the event queue, one byte was written through peer fd `11`, and exactly one matching `EVFILT_READ` event was read. The duplicated fd, guard, deletion, closes, and owned-byte restoration passed. [Capture and source](SANDBOX_WORKER_PATH_14.md). |
| Watched-fd close and numeric reuse | **Sequential controls passed on 14.00.** Closing watched fd `10` removed its event while duplicate fd `12` retained the old socket. A new socketpair reused numeric fd `10`; neither the old nor replacement source signaled until separately registered. Guards and cleanup passed. These outcomes define the baseline for a concurrent mismatch check; they do not show the race. [Captures and plan](FD_REGISTRATION_RACE_14.md). |
| Shared page/worker rendezvous | **Unavailable on the current LAN page.** `SharedArrayBuffer` is hidden, `crossOriginIsolated` is false, and a second capture reports `isSecureContext=false` over LAN HTTP. Isolation headers alone cannot solve that transport gate. The native wait-then-register control passed twice, but page timestamps still cannot prove the narrow kernel interval. [Capability captures and plan](FD_REGISTRATION_RACE_14.md). |
| Sandbox filesystem view | **Partial 14.00 map.** Guarded native directory reads listed eight entries under `/` and six under `/dev`; every owned fd was closed. `/dev/null` returned immediate `ENOENT`; `/dev/random`, `/dev/dce`, and `/dev/dmem0` opened. One-byte `dmem0` read returned `ENODEV` with its output guard intact. [Raw captures and limits](SANDBOX_BOUNDARY_14.md). |
| Credential boundary | **Measured on 14.00.** A byte-checked `setuid(0)` returned `EPERM`; independent UID read remained `1`. [Captures](SANDBOX_BOUNDARY_14.md). |
| Process-signal boundary | **Measured twice on 14.00 with immediate error readback.** `kill(pid, 0)` and `sigqueue(pid, 0, 0)` each succeeded for browser PID `145`; each returned `EPERM` for parent PID `38`. The calls delivered no signal. This does not establish a Capsicum bypass or a sandbox escape. [Captures and limits](SIGNAL_BOUNDARY_14.md). |
| Process-information boundary | **Fresh 14.00 query and exact-source repeat.** A size-only process-record request succeeded for browser PID `145` with length `1096`, returned `EPERM` for parent PID `38`, and returned `ESRCH` for a nonexistent PID. An owned self-record read repeated and matched size, PID, parent PID, UID, process name, and thread count. [Raw captures and interpretation](PROCESS_BOUNDARY_MODEL_14.md). |
| Jail and capability-mode flags | **Source-derived interpretation, twice repeated.** The FreeBSD 9 shaped self record reports `ki_cr_flags=0`, `P_JAILED` bit clear, and `ki_jid=0`. Sony's own sandbox-state wrapper returned `1`. These fields steer research away from unverified standard-jail/Capsicum prerequisites; exact Sony flag semantics remain unknown. [Evidence and caveats](PROCESS_BOUNDARY_MODEL_14.md). |
| UMTX mutex owner writeback | **Passed on PS4 14.00.** Live number-454 operation `4` (try-lock) and the separately tested operation `5` (lock) each wrote owner word `101902` into a zeroed owned mutex. Operation `6` unlocked it and cleared the owner in both runs; all browser state and bytes restored. The word is TID-shaped, but no independent TID readback was taken. [Captures and limits](UMTX_SHM_GATE_14.md). |
| UMTX shared-memory candidate | **Availability gate did not pass.** The same live number-454 wrapper completed ordinary mutex and wake controls. Read-only operation-25 `ALIVE` and `LOOKUP` returned `EINVAL`; `ALIVE` still did so with a live RX mapping and with an owned address in the first argument, fourth argument, or both, matching an invalid-operation control. No shared-memory registration or destroy was attempted. [Captures and limits](UMTX_SHM_GATE_14.md). |
| Jail-status query | **Inconclusive.** `security.jail.jailed` resolved to a numeric MIB, but its direct read returned `ENOENT`; the same six-argument call successfully read `kern.osrelease`. [Captures](SANDBOX_BOUNDARY_14.md). |
| Descriptor replacement alternative | **No working route.** Number-92 commands `1` and `10` returned `EINVAL` on a held event queue; command `1` also returned `EINVAL` on `/dev/random`. Sony's command semantics remain unidentified. [Captures](SANDBOX_BOUNDARY_14.md). |
| Current 14.00 syscall-wrapper census | **Measured.** Three live 4 KiB pages contain 293 unique wrappers (115/117/61). Exact numbers are captured; `221`, `222`, and `510` are absent in that bounded region. [Census and limits](SANDBOX_WRAPPER_CENSUS_14.md). |
| Live browser-process launcher image | **Captured on 14.00.** A self-path query returned `NKWebProcess.self`; a guarded VM-map query found a small RX region matching its ELF entry and segment layout. Fifteen bounded reads recovered every byte of its 32 KiB live RX map, SHA-256 `85f5f0a1810caa122be109ed513d0638646e1a69369d5ba3e899df4686453e96`. Static analysis shows fixed module loads and startup calls, but no controlled escape path. [Captures, artifact, and attribution limit](LIVE_PROCESS_IMAGE_14.md). |
| Loaded module inventory | **Passed on 14.00.** A byte-checked module-list call returned 27 handles; four guarded module-info batches named all 27, including `NKWebProcess.self` (handle `0`), `libSceSystemService.sprx` (`49`), and `libSceNKWebKit.sprx` (`73`). A separate module-info call returned zero for the address and size fields of `libkernel_web.sprx`; module presence alone does not show privileged access. [Exact capture list and names](LIVE_MODULE_INVENTORY_14.md). |
| System-service symbol gate | **No resolved export.** The byte-checked number-591 name lookup returned `-1`/errno `3` for two historical system-service names and the same result for a historical `libkernel_web` control. This does not establish an absent export or a sandbox policy; it rules out using those names through the tested call shape as a current address oracle. [Matched captures](SYSTEM_SERVICE_SYMBOL_GATE_14.md). |
| Live system-service executable image | **Captured on 14.00.** Handle `49` was named `libSceSystemService.sprx`; its `0x83711c000–0x837158000` RX mapping was reconstructed from 107 individually verified and restored reads, with exact coverage and an independent first-byte sample. SHA-256 `8dfeb423c92508348e6da8e75fdaf2d71fd4e5e3a09d6a73e3883da512213e05`. The synthetic ELF is for offline analysis only. [Capture provenance and limits](SYSTEM_SERVICE_IMAGE_14.md). |
| Live IPMI executable image | **Captured on 14.00.** Handle `27` was named `libSceIpmi.sprx`; its measured `0x833f00000–0x833f0c000` RX entry was reconstructed from 22 individually verified and restored reads, with exact coverage and a matching independent 64-byte sample. SHA-256 `6c6fcaf9c2bf7def0a18db20d33ac2cb0c75eef979138a2577654f3e5dda94a4`. Its adjacent read-only table (16,384 bytes, SHA-256 `345b9a0bdce6c36cd4b2fce2281ae97165a1e1dcdf900e88914c2b33ec0a98f5`) and 81,920-byte data entry (SHA-256 `33a47b16c014ebe800596686add5c83d17effe012db41f9740dbaff0cd040dd4`, almost all zero) were also recovered. Strings name the `sceIpmiMgr*` client/server/session API and several server configurations. [Image, content, and limits](IPMI_IMAGE_14.md). |
| IPMI client and name interface | **Reached on 14.00.** A byte-checked `IPMI::Client::create`/destroy pair returned `0` with kid `26191`; a later two-client run created kids `42575` and `9774`, and `GetClientName` returned both names to the same process. `GetServerName` on a client kid returned `0x80020002`, a working negative control. A connect attempt using nonexistent name `Fw14NoServerSvc` returned `SCE_KERNEL_ERROR_EAGAIN` (`0x80020023`, public error table) immediately with status `0`, no session, and full restoration; it does not yet separate a failed lookup from a queued request. A bounded 64-kid scan found no foreign object, and the observed kids show no usable sequence. [Evidence and limits](IPMI_CLIENT_14.md). |
| IPMI session to the system core | **Established on 14.00 and closed.** A raw syscall-622 connect using the client name `SceSysCoreApp` returned `0`; a subsequent destroy returned `0x80020010` (`EBUSY`) because the client remained connected. A session-PID query returned PID **`38`** (the browser's parent), and explicit disconnect/destroy returned `0/0`. The matched nonexistent-name raw connect returned `ESRCH`. No server method was invoked on that session, and no authority change, protected-resource access, or escape was demonstrated. After the CE-36329-3 crash and reboot, the same name yielded no session, and a session-only `SceSysCoreApp2` attempt coincided with a browser memory warning. After a later full power cycle, the official first-path getter and app-info getter each returned `0x80AA000B` cleanly; the App2 two-thread discriminator could not arm (worker wiring incompatible), so App2 was never reached. [Evidence and limits](IPMI_CLIENT_14.md). |
| Console stop after first LNC method attempt | **Unconfirmed, under investigation.** On 2026-10-21 at `07:26:07Z` the session's last heartbeat exactly matched the result of `clone_history_ipmi_lnc_status_v1`. That probe connected a `SceLncService` client by name but got `ESRCH` for the `0x30013` sync method and for disconnect; the method phase took about 6.7 s. The probe reported full restoration, then the console stopped and no further poll arrived. After restart the operator reported **CE-36329-3** (“system software” error), recording an operator-observed system failure; the failing component and cause remain unresolved. Later, a session-only `SceSysCoreApp2` connect produced a browser memory warning before any method and refreshed the page; the claimed command remains unresolved. No further IPMI calls are queued. [Incident record](INCIDENT_2026-10-21_IPMI_LNC.md). |
| SysCore app IPC client and spawn-shaped method | **Official read-only methods called and safe on 14.00.** The loaded `libSceSysCore.sprx` client exposes method ranges `0xaa110000-0xaa110024` and `0xaa120000-0xaa120021+`. After a full power cycle (PID `65`), the official `0x1bc0` getter and the `0x1cc0` app-info getter (app ID `0`) each returned `0x80AA000B` cleanly with full restoration — no panic, no warning, zeroed output; this makes the raw `0x320` marshaling the leading differential but does not attribute the earlier failure. Offline 2026-10-22: the ordinary library-mode call can return `0x80AA000B` locally; a later direct connected-client getter returned the same code through a distinct path, and its exact producer is unresolved. The first-path guard at RX `0x5e0` requires module bytes `+0xC088=1` and `+0xC089=1`; the fresh-boot RW image and baseline capture show `1/0` (library mode). The app-init function at `0x3a0` returns `0x80AA0003` while `+0xC088=1` and, if forced, calls App2 `0xaa120012` through the null client pointer at `+0xC060` (baseline `app2_client: 0`). Forcing the flag is a predictable null-deref, not a safe bypass. Live 2026-10-22 confirmation (capture `fb32e106`): SysCore base `0x81bb98000`, flags `1/0`, App2 client `0x0`, and the RX signatures match. The fixed worker App2 discriminator ran cleanly (capture `65ebf96e`): client create returned 0 (kid 58950), the raw connect returned -1 with worker-thread errno **ESRCH (3)**, `connect_hung=false`, no memory warning, and full restoration. The `SceSysCoreApp2` server is absent; the first-path `SceSysCoreApp` server exists. App2 app-init `0xaa120012` is unreachable, the first-path getters stay in library mode, and the spawn stays gated. **App2 is closed; do not retry.** A **five-input spawn/add-process-shaped** method at `0xaa110003` remains identified but uncalled and gated. Module RX/RO/RW are preserved. [Client record](SYSCORE_APP_CLIENT_14.md). |
| System-service process-type branch | **Measured on 14.00.** A live-byte-checked call to the function beside `sceSblACMgrCheckNonsecureWebcoreProcess()` returned `1` and restored browser state. The analyzed initializers use `0` for ShellCoreUtil/AppMessaging setup; LNC initialization precedes this branch. The exact security semantics of return `1` remain unverified. [Device capture and call graph](SYSTEM_SERVICE_IMAGE_14.md). |
| Reachable system-service status request | **Passed once on 14.00.** A byte-checked `sceSystemServiceGetAppStatus` path returned `0`, filled a 12-byte owned output buffer, restored it, and passed a post-call PID control. Live code routes the request through `SceLncIpcClient` to `SceLncService` with selector `0x30013`. This is a read-only, apparently permitted interface; no unauthorized effect was observed. [Device capture and code](SYSTEM_SERVICE_IMAGE_14.md). |
| System-service process-request gate | **Built-in launch path tested once on 14.00.** The live path-prefix import returned `uW0gp3J1i0`, and its `webapp.self` path opened read-only. Sony's own `sceSystemServiceLaunchWebApp` then used that path and its complete internal parameter structure with an owned `about:blank` argument. It returned `0x8094000F` and stored that error instead of a PID; browser state restored. This rules out a nonexistent path or our earlier malformed input structure as the sole explanation. The error still does not distinguish authorization, app-context, or transport policy. No process was launched. [Exact captures and interpretation](WEBAPP_LAUNCH_GATE_14.md). |
| Read-only LNC process/app queries | **Completed without data.** A 16-entry local-process status-list request returned `0x8094000F`, count `0`, unchanged 576-byte output and intact guards. App-type lookups for each of the two status words returned the same code with unchanged outputs. The status request itself still returned success. These responses narrow the reachable service surface but do not establish why the other requests failed. [Captures and analysis](SYSTEM_SERVICE_IMAGE_14.md). |
| Missing-wrapper syscall route | **Mismatched-number tail ruled out.** The same extended chain returned PID `144` through the mapped number-20 wrapper and its interior. Entering the identical suffix inside the number-456 wrapper with RAX `20` stopped after preflight; the operator saw a memory warning and refresh. Published PS4 opcode checks explain the pattern, although the 14.00 kernel code is not inspected. No semaphore syscall ran. [Matched captures](SANDBOX_WRAPPER_CENSUS_14.md). |
| Custom-syscall census (545–668) | **In progress: 116 wrappers byte-checked, ~60 classified.** Installer v27 located five additional low wrappers; v26 (caller64, exact [lo, hi] u32 pairs) carried the 10-22 kernel-pointer triad probes. Classification so far: always-succeed class (548/560 pl,ps/563/564/565/566/585→1/596/599/606/617/620/639/640/643), EPERM-gated (559/600/602/603/604/611/613/615(pid)/618/623/628/636/642), by-ID ESRCH lookups (555/556/595/616/632/633/634), ENOSYS for sampled values (627/635/641); 601 request 4 succeeds, 610 returns 2 for 0xffffffff, and 619 returns ENOSYS in its later 16-case matrix; name-keyed (551/607/630). **624 returns changing positive values; they are not established object IDs, and the historical name get_vm_map_timestamp is a competing interpretation.** 659 size/pointer shapes -> ENOMEM/EFAULT; 588 layout sweep -> EINVAL/EFAULT; no data. 592 validates its size word after copying (EFAULT at 0x400 with 108 bytes already copied). [NamedObj record](NAMEDOBJ_14.md). |
| NamedObj create/delete family | **Kind gate demonstrated; 557/601 zero-field interaction negative.** 557 creates and 558 deletes owned objects; handles use `(generation << 13) | slot`. The one-generation stale-handle deletion is rejected (two captures). The `0x4000` kind distinction repeated on a fresh page. A 601 request-1 buffer with the same name returned EINVAL both before and after creating a matching object, with no output change. No kernel bug is established. A separate name test showed arg2 is not simply name length; its meaning remains unknown. [Record](NAMEDOBJ_14.md). |
| Syscall 661 malformed-call outcome | Four malformed calls ended the WebProcess before a result; no console panic. A historical public table names 661 `aio_submit`, invalidating our intentional-exit hypothesis. The 14.00 ABI and cause of termination remain unknown. [Record](NAMEDOBJ_14.md). |
| Sandbox boundary map | In progress. A concrete credential denial, browser filesystem view, and matched self/parent signal permissions are measured. Two browser threads made overlapping benign native calls and twice completed a bounded event-queue wait/wake. Socket readiness, alias-close, and descriptor-reuse controls provide a source-specific baseline. Nine native-chain registration/close comparisons produced ordinary replacement or `EBADF` outcomes, without a 14.00 kernel-window overlap oracle. Number-454 mutex lock and unlock worked, but its shared-memory operation `25` returned `EINVAL` under both tested address-slot layouts. The targeted-thread signal interface is reachable, but has no safe cross-boundary delivery oracle. An actual 14.00 multicast input-order result lowers the priority of one upstream UAF mechanism. A raw IPMI connect established a session to `SceSysCoreApp` in the browser's parent PID 38; the session was queried and cleanly closed, but no method or authority change was demonstrated. The loaded `libSceSysCore` client’s spawn-shaped method `0xaa110003` is identified offline, but no spawn request was sent. After a full power cycle the official first-path getter and app-info getter returned `0x80AA000B` cleanly, proving safe read-only dispatch; the App2 app-init gate remains unreachable (App2 connect warns before any method). [Evidence rule and source comparison](SANDBOX_BOUNDARY_14.md), [worker path](SANDBOX_WORKER_PATH_14.md), [SysCore client](SYSCORE_APP_CLIENT_14.md). |
| Sandbox escape | Not demonstrated. No credential, jail-state, protected-resource, process-launch, or kernel-memory effect has been observed. The SysCore spawn-shaped method has not been called. |
| RegMgr permission gate | **Selective on live 14.00.** Command 0 returned `EPERM`. The browser's `SYSTEM_LANGUAGE` key read through command `0x19` returned status `0` and value `1`. Two browser-adapter keys returned syscall `0` but RegMgr status `0x800d0203` with no value, showing why transport return must be checked separately. No registry write or escape has been observed. [Module image and exact captures](REGMGR_IMAGE_14.md). |
| Full loaded-SPRX memory capture | **Complete for this browser session.** All 26 loaded SPRX modules and 78 RX/RO/RW mappings (111,853,568 bytes) were assembled with exact coverage and per-segment SHA-256. A live import-link map resolves 3,377 candidate thunks across 105 module edges. The dump contains browser-process client code, not privileged server or kernel code. [Manifest, method, and limits](FULL_SPRX_DUMP_14.md). |
| All-module boundary audit | **First pass complete across all 26 loaded modules.** Every mapped byte was rehashed; each module has a role, import/path signal, and 14.00 boundary status in the [all-module audit](ALL_LOADED_MODULES_14.md). Focused client analysis found Sysmodule's ID-table loader, RegMgr's keyed reads and data wrappers, a connected-but-failing Mbus query, failed AvSetting initialization, and a VideoOut DCE query returning `EPERM` after successful initialization. This is structural triage plus selected decompilation, not exhaustive reversing of privileged implementations. |
| Sysmodule AuthMgr route | **Unavailable at the first device gate.** Four 14.00 client functions open `/dev/authmgr` with flags `2` before distinct ioctl requests. A matched browser open returned `ENOENT` and restored state; no ioctl ran. [Source and capture](SYSMODULE_CLIENT_14.md). |
| Net BPF route | **Unavailable at the first device gate.** The 14.00 `libSceNet` client opens `/dev/bpf0` with flags `2` before BPF ioctls. A matched browser open returned `ENOENT` and restored state; no BPF request ran. [Source and capture](NET_DEVICE_GATE_14.md). |
| Source-mentioned device paths | **Measured on the current 14.00 page.** Ten `libkernel_web`/libc device names returned `ENOENT`; a source-matched SystemService `/dev/sbl_srv` open also returned `ENOENT`. Matched `/dev/random`, `/dev/rng`, and `/dev/dmem0` opens succeeded and closed, validating the native pointer route. These results narrow reachable device nodes but do not change authority. [Exact captures and limits](DEVICE_PATH_CENSUS_14.md). |
| Kernel exploit | Not demonstrated. |

The History primitive now supports a current-process code read and a reproducible browser native call built from live 14.00 measurements. The next major boundary is a browser sandbox escape; a kernel path remains separate and unproven. The code-execution milestone here is code reuse through existing mapped instructions, with an owned output oracle and pointer restoration.

