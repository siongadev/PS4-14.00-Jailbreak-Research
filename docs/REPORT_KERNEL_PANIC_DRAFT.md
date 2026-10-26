# [REPORT] Userland-Initiated System Failures via Raw IPC Marshaling — LNC/SysCore Test Series (PS4 firmware 14.00)

Status: draft for internal review. Companion to P1/P2/P3. Environment:
retail PS4, firmware 14.00, WebProcess context (browser), UID 1,
sandboxed. All events 2026-10-21 UTC. Full instrumented record:
[INCIDENT_2026-10-21_IPMI_LNC.md](INCIDENT_2026-10-21_IPMI_LNC.md);
evidence archives `2026-10-21-ipmi-syscore-panic.zip` (SHA-256
`b331bb32…`) and `2026-10-21-syscore-freshboot.zip` (SHA-256
`c5b9cb74…`), both verified.

## 1. Summary

During evaluation of the browser-reachable IPMI user→kernel IPC
mechanism (`ipmimgr_call`, syscall 622 family), hand-marshaled
requests to two privileged system services produced **two independent
console-wide system failures** (recovery code CE-36329-3 after each),
while every comparable call through official client code completed
cleanly. The browser process itself reported full state restoration
and posted its results before both failures — the failures occurred at
the system level, outside the WebProcess.

A controlled differential after the second failure (the same getter
operations executed through the official `libSceSysCore` client
functions instead of the hand-built marshaling) returned clean service
error codes (`0x80AA000B`) with no instability, attributing both
failures to the raw marshaling layer rather than the services' normal
dispatch path. Whether the faulting component is the kernel, a system
service, or a watchdog is not established (CE-36329-3 does not
identify it); no kernel log or serial output was available.

## 2. Tested interface

`ipmimgr_call(op, kid, resultPtr, paramsPtr, paramsSize, 0)` —
syscall 622 — constructs an IPC session to a named system service
(`SceLncService`, `SceSysCoreApp`) from the sandboxed browser process
and carries `invokeSyncMethod`-shaped requests: operation `0x400`
(connect), `0x320` (synchronous method invoke), plus disconnect/
destroy. The raw `0x320` parameter layout used in these tests was
reconstructed from live module analysis, not from an official client.

## 3. Failure one — `SceLncService` method `0x30013`

Timeline (all UTC, command `39ee443d…`, probe
`clone_history_ipmi_lnc_status_v1`, capture `8f23dc8f…`):

- `07:26:00` — client `SceLncService` created and connected via
  operation `0x400`: raw return 0.
- `07:26:07` — sync method `0x30013` via operation `0x320`: raw
  return −1, errno 3 (ESRCH), no method result, output buffer
  unchanged. Disconnect also ESRCH; destroy 0. Probe reported full
  browser-state restoration (PID 145 unchanged, all saved words
  verified) and delivered its result capture.
- Immediately after result delivery the console shut off. Restart
  reported **CE-36329-3** (system software error). The collector saw
  the result POST as its last request; no further poll arrived.

The 6.7-second method phase and the ESRCH pair indicate the LNC server
held no usable session for this client; the request that preceded the
system failure was therefore a **malformed/unsupported request
delivered to a privileged service path from an unprivileged process**.

## 4. Failure two — `SceSysCoreApp` getter `0xaa110000`

After reboot (fresh browser PID 63, remeasured module bases), a fresh
`SceSysCoreApp` client connected (raw return 0); the raw session-PID
query returned −1/EFAULT and the client destroy returned EBUSY
(session present). A follow-up command (`87df422b…`) called the
read-only getter method `0xaa110000` through the same raw `0x320`
layout. Markers: `syscore_info_preflight`, `syscore_info_connected`,
`syscore_info_session` — then nothing. The operator observed a
**kernel panic and console shutoff** at that point; the command
remains `claimed` with no capture, so the faulting instruction is
unknown. The raw session-PID EFAULT in the same session already
showed the hand-built `0x320` layout was malformed for this service.

## 5. Attribution differential (post power-cycle)

After a full power cycle, the identical getter operations were run
through the **official `libSceSysCore` client functions** on the
browser's own first-path client object:

| call | path | result |
|---|---|---|
| first-path getter `0x1bc0` | official client fn | `0x80AA000B`, full restoration, no instability |
| app-info getter `0x1cc0` | official client fn | `0x80AA000B`, zeroed 0x48-byte output |

Both clean results prove the read-only dispatch path, the service,
and the kernel handle these requests safely when the marshaling is
correct — isolating the failure to the hand-built `0x320` parameter
layout. Separately, `SceSysCoreApp2` connect attempts coincided with
browser memory warnings pre-dating any method; the 2026-10-22 worker
discriminator later showed the same connect completing as a clean
−1/ESRCH with no thread or process effect, marking those warnings
environmental rather than connect-caused.

## 6. Impact and classification

- A sandboxed browser process, constructing otherwise well-formed
  IPC sessions through the documented `ipmimgr` interface, could
  deliver malformed marshaled requests to at least two privileged
  system services, and two such requests ended in **system-wide
  failures requiring physical reboot** (system-reported
  CE-36329-3 both times).
- Availability only: no data exfiltration, no persistence, no
  unauthorized action, and no evidence of kernel code execution was
  observed. The root cause is unproven — malformed input handled
  without validation somewhere in the service/kernel path is the
  supported hypothesis; a defect purely in our reconstruction of the
  ABI that triggers a pre-existing robustness gap cannot be fully
  excluded, though the official-client differential weighs against it.
- CE-36329-3 does not identify the faulting component; without a
  kernel log the split between kernel panic and privileged-service
  fault remains open.

## 7. Gates established (standing)

1. Never repeat: raw `0x320` invokes, methods `0xaa110000`/
   `0xaa110002`/`0xaa110003` (spawn-shaped), `SceLncService` raw
   methods, or either SysCore server name outside the official-client
   differential — absent a new, reviewed rationale.
2. The official-client path (`0x1bc0`, `0x1cc0`) is verified safe and
   is the only sanctioned dispatch route.
3. Any future IPC test requires: one controlled call, full markers,
   operator physically present, Error History checked before and
   after, and a fresh evidence archive.

## 8. Evidence index

LNC capture `8f23dc8f…`; connect/control `970482ce…`; session-PID/
cleanup `4c5ef8b2…`; post-reboot session failure `911755ec…`;
official getter `9ad47e4e…`; app-info getter `e0dca755…`;
fresh-boot baseline `41bf385e…`; SysCore RW image
`rw_0x818f10000_14.00.bin` (SHA-256 `91b4101d…`); pinned probe source
`clone_history_ipmi_lnc_status_v1.js` (SHA-256 `c0741e29…`); claimed
SysCore-getter command `87df422b…` (no capture — the panic). Full
lists in [INCIDENT_2026-10-21_IPMI_LNC.md](INCIDENT_2026-10-21_IPMI_LNC.md).
