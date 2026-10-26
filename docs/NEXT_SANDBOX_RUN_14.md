# Next PS4 14.00 sandbox-path run

**Current phase closed (2026-10-24):** A fresh same-page `RTM_GET`
control passed, then the bounded route-table mutation returned
`-1/EPERM` for `RTM_ADD` of `198.51.100.0/24` via `127.0.0.1`.
A second routing socket never observed the exact route; descriptor
cleanup, process identity, and frame guards passed. This closes that
exact route-table authority contract
([verified record](ROUTE_SOCKET_14.md)). The browser native-execution
milestone remains demonstrated; sandbox escape and kernel read/write do
not. No further route-message variation should run without a distinct
Sony-specific vulnerability hypothesis and an independent state or
memory oracle.

The final concrete service contract was exhausted once. The bounded
VideoCore call used the ordinary caller's exact `0x9f8` structure, a
unique non-DOM URL, and `+0x970 = 0`. Create returned `0` with handle
`1`; play-status returned `0`; delete returned `0`; all guards restored.
The independent collector received no URL request. This is an accepted
service-object lifecycle without a transport or protected effect, so
the branch is closed for this phase
([capture and oracle](VIDEOCORE_CLIENT_14.md)). Do not set
`+0x970 = 1`, improvise descriptor-passing requests, or repeat this
exact lifecycle.

**Latest live limit check (2026-10-24):** The fresh 14.00 browser page passed
the byte-checked fixed-194 wrapper and returned a `getrlimit(10)` soft limit
of 1,536 MiB and hard limit `0x7fffffffffffffff`. The user saw both values
in the PS4 log; the page remained responsive with no warning. This confirms
the current virtual-memory limit but does not explain prior memory warnings.
[Capture and startup analysis](FULL_WEBPROCESS_REVERSE_14.md).

Concurrent same-ID deletion now runs on two prepared 14.00 browser
threads with separate result buffers. One single-request run reported two
per-ID successes, but six repeats returned one winner; eleven two-request
and twenty-two three-request MULTI-object runs also returned one winner with
normal sibling state and cleanup. After one browser reopen, one initial
run plus twenty repeats in the same WebProcess all returned one winner;
a post-delete 666 call found the ID gone.
The published older double-free requires
a multi-request object, so the single-request output is a lead rather than
a kernel-memory result. The exact captures and limits are in
[AIO_14.md](AIO_14.md). A separate exact-call test found that 558 with
candidate kind `0x160` rejected both completed and pending AIO IDs with
`ESRCH`; ordinary AIO cleanup succeeded. There is no positive `0x160`
control or proof that AIO IDs belong to the historical 558 object family,
so this result does not validate a generic AIO deletion path. A different,
measured 14.00 effect is required before claiming a handle-lifetime bug.

**Composition update (2026-10-24):** The connected 14.00 page ran four
producer/consumer chains with verified captures, recorded in
[CHAIN_COMPOSITION_14.md](CHAIN_COMPOSITION_14.md). Pending AIO held its
original socket after descriptor-number reuse; 192 serial AIO
completion/delete attempts all received `EBUSY` before normal cleanup;
the owned NamedObj/debug-init sequence left the debug-service result
unchanged; and a SystemService kill using the live app-status ID received
the same denial as an absent-ID control. Do not repeat those exact serial
shapes. The next device candidate should come from a distinct, live
14.00 server method or a testable concurrent kernel transition, with
readback beyond a success code and cleanup of every owned resource.
The live VideoCore IPC client is now closed for this phase. Its normal
media-stream caller writes `+0x970 = 0`; the create entry rejects
nonzero `+0x970`, and `/system_tmp/SceKernelDescPassing` was absent in
the idle-page check. The exact create/status/delete lifecycle accepted
and cleaned handle `1`, but the unique URL never reached the collector.
No protected or unauthorized effect appeared.

**AIO correction and completed controls (2026-10-23):** A 14.00 socketpair
read submitted through 669, then the browser stopped after the marker
before syscall 663. The operator reported a system-wide freeze and
rebooted. **663 is `aio_multi_wait`, not cancel**; the probe passed a
null timeout on an unreadable socket. Do not rerun
`clone_history_aio669_socket_pending_cancel_v1`. The hash-checked
14.00 `libkernel_web` callsites confirm 663 has a five-argument wait
shape and 666 has a three-argument cancel-shaped call. On a fresh page,
the v51 caller completed the
[completed-request 666 control](../probes/clone_history_aio669_completed_cancel_v1.json),
the [socketpair submit/write/poll/delete
control](../probes/clone_history_aio669_socket_pending_control_v1.json),
and the [corrected pending 666 test](../probes/clone_history_aio669_socket_pending_cancel_v2.json).
All three controls passed, and a finite 10,000-usec 663 wait returned
`ETIMEDOUT` while the socket read was pending. See
[verified captures and limitations](AIO_14.md).
**Result:** direct processing deletion and cancel-then-processing
deletion both returned per-ID `0x80020010` (`EBUSY`); after a peer byte,
completion and deletion succeeded. [AIO record](AIO_14.md). Do not
repeat these sequential paths without a new 14.00-specific mechanism.

**Latest auth-info gate (2026-10-23):** The live 587 PID selector returned
136-byte records, but a PID with a browser-similar prefix still failed
`KERN_PROC_PID` with `EPERM`; the parent failed the same control. A
source-shaped 607 lookup of the browser's own SELF path returned
`EACCES`. Neither changes authority. [Capture record](AUTHINFO_BOUNDARY_14.md).
Further auth PID sweeps are lower priority than locating a 14.00 client
action with an independent protected-effect readback.
The upstream poll/select UAF patch affects netmap and process descriptors;
neither has a validated browser descriptor-creation path in our 14.00
captures. [Reachability screen](POLL_SELECT_UAF_SCREEN_14.md).
The source-defined Sysmodule RegMgr branch returned `EPERM` for its
capability-gated key and application status `0x800d0203` for its browser
fallback, both with no value. [Matched captures](AUTHINFO_BOUNDARY_14.md).
`/dev/dce` opened but rejected the tested shared read-only `mmap` with
`EACCES`; together with the earlier `/dev/dmem0` denial, the two tested
devices do not reach the [device-pager prerequisite](DEVICE_PAGER_GATE_14.md).

**Latest gate (2026-10-23):** A fresh page passed the native setup and
27-entry census after the census was corrected to accept the main
`NKWebProcess.self` image below 4 GiB. The live SystemService request
builder proved that output descriptors use a 24-byte stride. With that
layout, LNC methods `0x3002f` (ShellUI-reboot status list), `0x3000f`
(local status list), and `0x30030` (GPU crash status) reached the service
and each returned `0x8094000F`, with no entries or protected data.
[Exact captures and ABI correction](LNC_SHELLUI_REBOOT_LIST_14.md).
This LNC status-read branch is closed unless a different authorization
context can be demonstrated. A separately matched `getAppFocusedAppStatus`
(`0x30020`) read also returned the same denial while the current-app
status control succeeded. [Capture](../captures/7f5bf6475c5e40d89cf32d8af30df1c6.json).

The full live `libSceIpmi` image supplied
the 48-byte synchronous method layout. Corrected raw `0x320` calls on
already-connected VideoCore and LNC clients returned success; LNC
`0x30013` matched the official 12-byte response exactly. Changing only
the packet's last word to zero reproduced the older `ESRCH` and
six-second delay. The capture arrived, then polling stopped. The operator
was asleep and later found the console off, so the immediate on-screen
outcome is unknown and the shutdown cannot be attributed to the probe.
[Packet analysis](IPMI_RAW_METHOD_ABI_14.md).
All 76 LNC client method wrappers are now indexed from 14.00 bytes.
The list and GPU-status methods have now been dispatched on a fresh
page and each returned the same service denial. The next device call
should come from a different source-defined client path and have an
independent protected-resource or authority oracle. Repeating LNC
status methods without a changed authorization context will not
distinguish their server-side gate.

Preserve the raw-IPMI/LNC freezes, loss of polling, shutdown reports,
and CE-36329-3 as an **availability lead only**. They are not confirmed
kernel panics and do not advance the sandbox-escape milestone: no kernel
log, serial trace, attributed Error History entry, or faulting instruction
identifies the failing component. Correctly formed official-client calls
returned cleanly, making the hand-built raw marshaling the leading
differential without proving causation. Do not repeat those raw failure
shapes as escape tests.

Treat syscall names throughout this plan as historical/upstream ABI
hypotheses. The observed 14.00 evidence is the fixed wrapper number,
bytes, call shape, and result; a name becomes current-firmware evidence
only when a captured 14.00 callsite or live contract supports it. In
particular, historical 558/669/666 and 194/195 labels do not by themselves
establish generic object deletion, cancellation effect, or resource
selector semantics.

The [public 14.00 source gate](PUBLIC_14_SOURCE_GATE.md) separates
incomplete third-party stage code and post-exploit patch offsets from a
tested 14.00 entry. Neither is a runnable sandbox escape on this console.

**All-module audit (2026-10-23):** All 26 loaded browser modules and 78
mappings were hash-checked and individually screened in the
[module audit](ALL_LOADED_MODULES_14.md). The highest-interest live
clients are RegMgr, SystemService, IPMI and NetCtl. The source-matched
RegMgr `SYSTEM_LANGUAGE` read returned `0` with value `1`, while command
0 had returned `EPERM`; this is a selective read permission, not an
escape. [RegMgr record](REGMGR_IMAGE_14.md). The Sysmodule loader takes
a table-listed module ID and constructs its own path; it is not an
arbitrary-path load entry. [Loader record](SYSMODULE_CLIENT_14.md).
The browser-adapter RegMgr callsites have now been analyzed. A further
broker test needs an exact 14.00 request contract and an independent
authority oracle. Reusing the language key adds no boundary information.

The full Sysmodule fixed-ID table was decoded from this page's 14.00
image. A source-listed `libSceUserService` load returned `0x80020002`
with no new handle, and a read-only open of the exact retail path
returned `ENOENT`. That branch does not currently add a user-service
client to inspect. [Table and captures](SYSMODULE_CLIENT_14.md).

The [26-module fixed-wrapper import map](ALL_MODULE_KERNEL_IMPORTS_14.md)
verified 186 bound syscall slots. Its new number-649 Sysmodule lead was
tested on the running 14.00 page: a source-shaped, guarded call returned
the module's own parameter block (size `0x20`, SDK `0x14008001`). It
does not reach another process or alter permissions. Do not spend the
next device run enumerating more member indices without a separate
cross-process or kernel-data hypothesis. The broader mapped path screen
found timezone files read by browser-loaded SystemService code and
network-capture paths in `libSceNet`, but no new privileged server image
or independent authorization effect. [All-module path screen](ALL_MODULE_PATH_SCREEN_14.md).

The separate [VideoCore IPMI gate](VIDEOCORE_CLIENT_14.md) has a
checked generic-client failure (`0x80dc0001`), but the module's own
client is already connected: a read-only session query returned peer
PID 46 while the browser was PID 74. Its 14.00 event loop receives
seven queue classes and dispatches local callbacks. The live session
alone is not a permission change. Its source-defined, zero-input
`0x12340017` query
subsequently returned `0` with four-byte output `1`, preserving the
guards and browser state; later calls showed that output is a changing
value rather than a stable capability bit. The bounded normal media
contract also completed create/status/delete but produced no collector
request or protected effect. Do not continue this client without a
different source-defined method and a distinct protected-resource or
authority-effect oracle.

**Mbus and AvSetting follow-up (2026-10-23):** A checked Mbus initializer
established client state `2` on the current page. Its only selected
zero-input/output-buffer query (`0xce110038`) returned `0x809b00ff` and
zeroed the owned output; no useful data or authority effect resulted.
AvSetting initialization returned `0x809a00ff` and left state `0`.
The stale nonzero pointer slot must not be passed to a method.
[Exact 14.00 captures](MBUS_AVSETTING_CLIENTS_14.md). Further calls in
these clients need a source-derived method contract and an independent
permission or protected-resource check.

**Follow-up result:** The browser-adapter root-certificate and Boolean keys
both returned RegMgr status `0x800d0203` despite syscall return `0`; no
setting value was delivered. The source-matched `/dev/authmgr` open in
Sysmodule returned `ENOENT` before any ioctl. These branches do not yet
offer a protected-resource effect. Continue with an initialized broker
method whose 14.00 client code establishes the full request structure and
an effect oracle; do not repeat these inputs. [RegMgr](REGMGR_IMAGE_14.md),
[Sysmodule](SYSMODULE_CLIENT_14.md).

The [Net BPF gate](NET_DEVICE_GATE_14.md) also returned `ENOENT` for the
client's exact `/dev/bpf0` path and flags, before any ioctl. Do not treat
the captured BPF ioctl numbers as a runnable browser attack surface unless
a distinct, verified path first reaches the device.

The [all-module device-path census](DEVICE_PATH_CENSUS_14.md) found
`ENOENT` for ten diagnostic/hardware names from the captured libc and
`libkernel_web` images. The current page's `/dev/random`, `/dev/rng`, and
`/dev/dmem0` positive controls opened and closed; the source-matched
SystemService `/dev/sbl_srv` open returned `ENOENT`. These tested names
do not provide a new service route. A future device probe needs an
existing node and a source-derived operation, not another string-only
candidate.

**VideoOut device screen (2026-10-23):** Four 14.00-source-matched
`/dev/dipsw` getters returned zero-filled output and closed cleanly;
the captured VideoOut DCE handle was uninitialized (`-1`). A later
checked initializer opened `/dev/dce`, but an exact output-shaped
subcommand-10 query returned `EPERM` with no data, then closed/reset
the descriptor. This is no sandbox crossing. Do not repeat these getter
or zero-context DCE inputs. A further DCE command needs a distinct,
source-derived client context and an independent protected-resource oracle.
[Device record](VIDEOOUT_DEVICE_GATE_14.md).

**New NetCtl control (2026-10-23):** The captured browser-side
`libSceNetCtl` client completed a zero-input/four-byte-output method
`0x20004` call with return `0` and output `3`. The null-output control
returned `0x80412107` with no output change. Both restored the native
caller and the same page kept polling. [Client and captures](NETCTL_CLIENT_14.md).
This confirms a read-only broker path, but a repeated network-state
query has no authority oracle. Six other output-only methods each
returned `0x804121a1` and zeroed their outputs. Do not repeat this
family. Advance NetCtl only after identifying a distinct method contract
and an independent protected-resource effect.

**Current page preparation (2026-10-22):** Use
`python tools/prepare_native_session.py NEW_CONNECTED_AS_ID` after a
refresh. The helper checks that exact session is actively polling and
requires a passing capture at each stage. It falls back to the wide
History-layout gate, retries at most four anchor-groom batches, expands
typed cells once if necessary, and installs the byte-checked v31 caller.
The successful [wide-window recovery](SESSION_CALIBRATION_14.md) and
[parent-thread boundary test](THR_SIGNAL_ZERO_14.md) used this procedure
on the latest page. The older seven-item manual sequence below is a
historical record and should not be used as the current dispatch recipe.
No pointer, heap index, PID, or wrapper address should be copied from a
prior page. The historical number-572 VM-query shape returned only
`EINVAL` in [the current device check](VM_QUERY_GATE_14.md); it is not
an established kernel-data read path.
The new [route-message gate](ROUTE_SOCKET_14.md) is the best confirmed
kernel input/readback surface from this page. Its upstream length-255
shape returned cleanly, so do not repeat that exact request as a crash
probe; choose a Sony-specific parser difference first.
The [device mapping gate](DEVICE_PAGER_GATE_14.md) opened
`/dev/dmem0` but received `EPERM` from a read-only `mmap`, while the
same wrapper mapped and unmapped anonymous memory. That tested device
cannot reach the unmanaged-device-pager prerequisite from this browser.
The [full RX mapping census](SANDBOX_WRAPPER_CENSUS_14.md) found exactly
the same 293 wrappers as the earlier three-page scan, with none outside
that old window. Do not repeat a wider scan of this mapping on the same
page; missing numbers `221`, `222`, `510`, `518`, and `571` need a
different verified entry, not another scan of these bytes.
The [601 request-0 status check](MDBG_REQUEST0_STATUS_14.md) now has a
stable eight-byte output of `0x100`. Request 4 and nine other successful
selectors left it unchanged, so this readback does not justify replaying
the same selector shapes. The [parent VM-map gate](PARENT_VMMAP_GATE_14.md)
returned `EPERM` using a PID measured on the live page. A new sandbox
candidate needs a distinct 14.00-controlled effect, such as a changed
protected-resource result or a source-backed request contract.
The [request-1 field sweep and two-pointer checks](MDBG_POINTER_GATES_14.md)
found no output or authority change. A later request-28 call stopped
reporting after its before-call marker; the operator reported a memory
warning and browser refresh. A new page has connected. Do not replay
that claimed command.

Update 2026-10-22: The two 601 selector-3 shapes each ended with an
operator-observed memory warning before any return capture. Do not queue
selector 3 again on the connected page. The page after the second warning
has a new session ID, so all former page-local pointers and native-call
plans are invalid. The current priority is a candidate with an independent
authority or kernel-data oracle; the selector-3 warning alone supplies
neither. See [the two-run record](MDBG_SELECTOR_14.md). Offline
verification also showed that forcing the SysCore app-context flag alone
would call through a null client pointer, so it is not the next device
test ([client record](SYSCORE_APP_CLIENT_14.md)).

Updated 2026-10-20. The [worker wait-then-getpid control](../probes/clone_history_worker_wait_getpid_v1.js) and [worker wait-then-register control](../probes/clone_history_worker_wait_register_v1.js) each passed twice on 14.00. Nine bounded **native-chain** close/reuse comparisons then used the same owned queue/socket setup: three returned replacement-only readiness, and six returned no event. The two later error-measured variants split between successful registration and immediate `EBADF` (`9`) on the worker; no old-source event appeared. No run proved overlap inside the kernel's fd-lookup-to-queue-lock interval. [Detailed results](FD_REGISTRATION_RACE_14.md). The small page-call delays did not reliably steer ordering, so this schedule is paused pending a different interval oracle.

Before dispatch, check `python -m fw14lab.control sessions` for a recently polling 14.00 session. The 2026-10-20 session `70f88a40719c4399a366ad3e30265d84` passed the service-status query at 14:04 UTC. Rest Mode or a page refresh destroys its page-local state, even if the same URL is visible. The local server remained on port 8765. If the console page has refreshed, connect a **new page session** and rebuild page-local state in this order, checking that each capture reports `pass` before advancing:

1. `clone_history_jsarray_storage_v1.json` — creates the forged view and owned JSArray state.
2. `clone_history_inrange_anchor_groom_v2.json` — measures a fresh page-local base and live anchor.
3. `clone_history_typed_cell_spray_v2.json` — places ordinary typed-array cells in the calibrated range.
4. `clone_history_typed_pair_setup_v1.json` — creates two owned 64 KiB typed arrays.
5. `clone_history_native_call_plan_v9.json` — derives this process's WebKit base and builds the page call plan after checking live bytes.
6. `clone_history_worker_owned_plan_v6.json` — allocates a separate worker call plan; this step makes no native call.
7. `clone_history_native_invoke_install_v12.json` — checks current wrapper, error-helper, and gadget bytes, validates four consecutive process-ID calls, and exposes guarded native calls. The v13/v14 installers also check two service-function entries, but their absolute addresses belong to the measured 2026-10-20 process mapping. On a fresh process, first remeasure that module mapping and function bytes before adapting those probes.

The current session passed the state-creating steps in that order: [forged view](../captures/4d5ab6d1b4494705ac493edb0835e726.json), [anchor](../captures/8d96e54adfce4086ab1962c883daf1f2.json), [spray](../captures/2ecd38b1496d408f88bb03257cc9ab66.json), [owned pair](../captures/4cc9923f23c648969d5b4989a4c73cac.json), [page plan](../captures/0fcb06531789482bad767ee29e91efaf.json), [independent plan](../captures/79d65351f89a49c285f215fb5584cff7.json), and [page caller v8](../captures/ae814c4fa3264c8e8394951e76b6cd6a.json). Earlier exploratory worker-layout probes were used to derive the implementation; the finalized worker controls check their transferred marker and live pointers each time. A fresh page still requires a fresh hardware pass for every state-creating step.

The [service-image record](SYSTEM_SERVICE_IMAGE_14.md) now provides the live 14.00 callsite that the earlier symbol lookup lacked. A byte-checked, read-only app-status call succeeded and filled 12 output bytes through the `SceLncIpcClient` → `SceLncService` path. A bounded local-process list and two app-type queries returned `0x8094000F` without data. A corrected nonexistent-path add-process request also returned that code. The later [built-in Web App launch gate](WEBAPP_LAUNCH_GATE_14.md) supplied a path independently opened on the browser, a full Sony-constructed parameter structure, and a process-ID effect oracle. It still returned `0x8094000F` with no PID. This rules out the earlier guessed path and malformed structure as sole explanations, but the exact error source remains unresolved. Park this LNC process-launch branch until server-side 14.00 evidence or a separate app-context/authorization discriminator exists; do not repeat equivalent launch arguments. The [fd close/reuse candidate](FD_REGISTRATION_RACE_14.md) remains paused because nine comparisons did not identify the kernel overlap interval. The [signal comparison](SIGNAL_BOUNDARY_14.md), [UMTX gate](UMTX_SHM_GATE_14.md), and [process record](PROCESS_BOUNDARY_MODEL_14.md) remain boundary controls. The UMTX gate now confirms ordinary mutex owner writeback but returns `EINVAL` for operation `25` with both plausible address slots, so repeating either exact operation-25 input is low priority. The prepared IPMI dump has now run to completion: 22 verified parts cover `0x833f00000–0x833f0c000`, preserved as [the IPMI image](IPMI_IMAGE_14.md). The page-local part counters for the RX, read-only, and read/write mapping dumps are exhausted for this page; all three are preserved, so do not enqueue those dumps again in this session. A byte-checked [IPMI client create/destroy, name-query, raw connect, and session cleanup](IPMI_CLIENT_14.md) completed. Raw syscall 622 returned `ESRCH` for the nonexistent control and **`0` for `SceSysCoreApp`**; the session-PID query returned **PID 38** (the browser's parent), and explicit disconnect/destroy closed it. A later `SceLncService` status-method attempt did not get a session: connect returned `0`, but method `0x30013` and disconnect both returned `ESRCH`. Immediately after that result the console stopped and never polled again; the restart reported CE-36329-3. After the reboot, `SceSysCoreApp` yielded no session and a session-only `SceSysCoreApp2` connect produced a browser memory warning before any method. **The IPMI gate is paused pending a full console power cycle, not just a page refresh.** The loaded `libSceSysCore` client’s getter/spawn method layout is recorded in the [SysCore client record](SYSCORE_APP_CLIENT_14.md): `0xaa110000`/`0xaa110002` getters and a five-input spawn-shaped `0xaa110003`. After a clean boot: rebuild the page chain, run only a read-only `SceSysCoreApp` session check plus the `0xaa110002` app-info getter, and do not call `SceSysCoreApp2` or the spawn method until the server is stable. Verify each capture with `python -m fw14lab.verify captures/CAPTURE_ID.json`; do not automatically retry a claimed command.

Update 2026-10-21: after a full power cycle, the official first-path getter and app-info getter returned `0x80AA000B` cleanly; App2 connections still warn before any method. Do not queue App2, raw `0x320`/`0x469`/`0x310` layouts, `0x3a0`, `0xaa120012`, or the spawn without a new isolation plan.

If the comparison interrupts, retain the last marker, leave the claimed command untouched, and ask the operator what appeared on screen when available. Polling stopping during sleep can mean Rest Mode; do not label it a crash. The [fd-race decision plan](FD_REGISTRATION_RACE_14.md) states the outcome gates and why a normal no-event result remains inconclusive.
