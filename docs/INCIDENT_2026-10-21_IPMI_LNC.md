# Incident: console stopped during/after the 2026-10-21 LNC method attempt

**Status:** ABI differential complete; app-init gate blocked. The operator checked **Settings → System → Error History** and found **no entries**. After a full power cycle and fresh boot (browser PID `65`, IPMI `0x8355e0000`, SysCore `0x818f04000`), the official `0x1bc0` getter on the browser's own first-path client returned `0x80AA000B` cleanly with full restoration. The read-only `0xaa110002` app-info getter also returned `0x80AA000B` with a zeroed `0x48`-byte output. These controls make the hand-built raw `0x320` marshaling the strongest differential for the earlier system-level failure; they do not identify the faulting component or prove a kernel panic. The App2 two-thread discriminator could not arm (worker butterfly walk incompatible with this boot's heap), so App2 was never reached; three prior App2 connection attempts all warned before any method. The first-path app context remains uninitialized and the spawn stays gated. Preserve this incident as an availability lead, separate from sandbox-escape evidence. Latest archive: `evidence/2026-10-21-syscore-freshboot.zip`, SHA-256 `c5b9cb7432c245d23b5dfb717fd418da73a776ed1b4b05416c741c32d4a75b30` (839 captures, 846 probe snapshots, 42 live artifacts; 1,728 manifest entries verified).

## Timeline (UTC)

| Time | Event |
| --- | --- |
| `07:26:00.628` | Command `39ee443dbba44d318c8b0ff709631be6` (`clone_history_ipmi_lnc_status_v1`) claimed. |
| `07:26:00.757` | Probe marker `ipmi_lnc_preflight`. |
| `07:26:00.779` | Probe marker `ipmi_lnc_connected`. |
| `07:26:07.507` | Probe marker `ipmi_lnc_method`, about **6.7 s** after connect. |
| `07:26:07.526` | Probe marker `ipmi_lnc_cleanup`. |
| `07:26:07.547` | Probe marker `ipmi_lnc_restored`. |
| `07:26:07.568` | Result capture delivered (`8f23dc8f23024f2a90785b925b10504d`); this is also the session's **last heartbeat**. |
| after | No further poll. Operator reported the PS4 shut off. |
| later | Console restarted and the operator reported **CE-36329-3**. Fresh research-page sessions `6ea983b6027846f6a4989506c2ade4aa` and `23b52273cfa54415a3cdbe7c06cddd8a` were created; the old session `70f88a40719c4399a366ad3e30265d84` never returned. |

The collector stayed healthy and listening; the server log's last request is the result POST at the same second. The page did not refresh into a new session. [Sony's public CE-36329-3 page](https://www.playstation.com/en-us/support/error-codes/ps4/ce-36329-3/) labels it a system-software error; it does not distinguish a kernel panic from a system-service or browser-process crash.

## Last probe result

The probe created a client named `SceLncService`, connected it through raw `ipmimgr_call` operation `0x400` (return `0`), then invoked sync method `0x30013` through operation `0x320` with no input and one 16-byte output buffer.

| Field | Value |
| --- | --- |
| client kid | `34333` |
| connect | raw return `0`, errno `0`, status `0` |
| method | raw return `-1`, errno `3` (`ESRCH`), method result `0` |
| output | unchanged `a5` bytes, size still `16` |
| disconnect | `-1`, errno `3` (`ESRCH`) |
| destroy | `0` |
| restoration | browser PID `145` unchanged; carrier, scratch, function slot, pivot, and chain restored |

The session was not established: the connect returned success, but the method and disconnect both reported `ESRCH`. The probe did not receive a method result.

## Interpretation and limits

**2026-10-23 ABI correction:** The complete 14.00 IPMI image has since
been decompiled and the 48-byte method packet tested against two live
module-owned clients. Sony's synchronous wrapper sets packet+`0x28` to
`1`; this incident's hand-built packet set it to `0`. A corrected raw
LNC `0x30013` request on the already-connected SystemService client
returned the same 12 bytes as its official wrapper, with zero result
words and no warning. A one-word differential on that same connected
client reproduced `-1/ESRCH`, untouched output and a roughly 6.7-second
method phase when the final word was `0`; the capture arrived, then the
page stopped polling. The on-screen result is pending an operator check.
[Packet analysis and captures](IPMI_RAW_METHOD_ABI_14.md). This strongly
explains the old method's `ESRCH`; whether it also explains the later
console failure is still unresolved. The old run also lacked a verified
session.

* The console stopped at the exact second the probe result was delivered and later reported **CE-36329-3** (“system software” error). This is a strong **temporal association** with the LNC attempt and confirms a system-side failure, but it is **not proof** of a kernel panic. A system-service fault, watchdog reset, or another system crash remains possible; CE codes do not identify the faulting component.
* The probe itself reports full browser-state restoration and a completed result. The shutdown happened **after** the result was posted, so the last capture is valid; there is no capture or marker after it.
* The 6.7-second method phase and `ESRCH` match the 2026-10-23 differential with the final control word set to zero. The original request copied the method's descriptor shape but missed this word from the live `invokeSyncMethod` wrapper. The old client's session was not independently verified. Server-side method format and authorization are **not** established. The new page stopped polling after its capture; the operator has not yet checked its on-screen state, so a post-result failure remains possible.
* No kernel log, serial console, or Error History entry has been inspected yet. The project's earlier memory warnings left the browser open and did not shut the console off; this event is different and should be treated more seriously until the console reports otherwise.

## Recovery checklist

1. Restart the console only after it is fully off; do not repeatedly power-cycle.
2. Check **Settings → System → Error History** and note any new system or Internet Browser entry, including a CE code.
3. Note whether the console rebooted by itself, showed a system-software error/safe-mode prompt, or simply powered off, and whether it entered Rest Mode.
4. Do not open or reconnect the research page until the cause is discussed. The old page-local forged view, native plan, and session secret are gone after the shutdown.
5. Do not repeat the raw `0xaa110000` getter, the `0xaa110002` app-info getter through the raw path, or the `0xaa110003` spawn method. After the console restarts, one controlled differential only: a `SceSysCoreApp` session plus the official `libSceSysCore` getter function at RX `0x1bc0` with before/after markers. Another system-level failure there would strengthen the service-path availability lead; a return narrows the raw ABI. The latest evidence archive is `evidence/2026-10-21-ipmi-syscore-panic.zip` (historical filename; 742 captures, 812 probe snapshots, 40 live artifacts; SHA-256 `b331bb32f2924013f526fcc80ff29cafa4c91508bf2fd058254835d614b42b98`).

## Follow-up: post-reboot SysCore session attempts

After the reboot, the same `SceSysCoreApp` client name connected but had **no session**: the session-PID query failed, so the getter methods were skipped and the client was destroyed ([capture `911755ecb7e44a76b599d34f2e8465ef`](../captures/911755ecb7e44a76b599d34f2e8465ef.json), error `session_pid_unavailable`). No method ran and the console stayed up.

A second, session-only attempt using the alternate server name `SceSysCoreApp2` was claimed at `07:54:25Z`; only the `syscore_info_preflight` marker arrived at `07:54:26.077Z`, and the operator immediately saw a browser memory warning and the page refreshed. No result or `syscore_info_connected` marker followed. The new page session is `64ff96f4bba2471e8170abad7ce1caac`; the old `39438712bb284c2f83424d158221d66d` stopped. The claimed command is retained as `7ac1ba0cffba4ba0b919242e7bec4a06`, source SHA-256 `54f95a7201d4fc8def19e1185b66d2c01400d201e61b6606431cb3ff6c9b426b`; it has no capture.

This is a second indication that the post-CE-36329-3 IPMI server state is unsafe: `SceSysCoreApp` no longer yields a session, and a connect attempt to `SceSysCoreApp2` coincides with a memory warning before any method. The method IDs 0xaa11xxxx/0xaa12xxxx and the client-code mapping remain offline evidence only. Do not retry either server name on this boot and do not invoke methods.

## Second operator-observed system failure: raw SysCore getter attempt

After the full console reboot, the page chain was rebuilt and the IPMI module was remeasured at `0x8330fc000` with browser PID `63`. A fresh `SceSysCoreApp` client connected (`connect` raw return `0`); the raw session-PID query returned `-1`/`EFAULT`, so the first probe skipped the getters and the client destroy returned `EBUSY`, showing a connected session. A follow-up command (`87df422ba0974949a2c69bd67287b5ff`, source SHA-256 `aa3866ef8667af3c0ce37997c9f83f8a6d3a746cb923a1db280f5829dbb8edcd`) applied the same client and called the read-only getter `0xaa110000` after connect.

Markers arrived in order: `syscore_info_preflight` at `08:27:43.239Z`, `syscore_info_connected` at `.263Z`, and `syscore_info_session` at `.283Z`. No `syscore_info_getter`, method marker, result, or further poll followed. The operator reported that the console shut off immediately after the session marker and described it as a panic. The getter call is the last instrumented operation; the command remains `claimed` with no capture, so the exact faulting instruction and failing component are unknown. The raw session-PID query and disconnect both returned `EFAULT` while the raw connect succeeded, so the raw `0x320` data layout may itself be malformed. The next test uses the official `libSceSysCore` client function (RX offset `0x1bc0` on a freshly measured module base) for one getter call with before/after markers. A repeated system-level failure would strengthen the service-path availability lead; a normal return would narrow the malformed raw ABI. Neither outcome alone proves kernel execution or sandbox escape. The spawn method stays gated.

## Fresh boot: official getter differential and App2 discriminator status

The operator reported an empty Error History, then fully power-cycled the console. The fresh page session `5495a947e0dc44c0a94bcac6011eede1` rebuilt the full chain; module bases moved to IPMI `0x8355e0000` and SysCore `0x818f04000` with browser PID `65`. Read-only baselines confirmed RX `0x818f04000–0x818f0c000/5/9`, RO `0x818f0c000–0x818f10000/1/9`, RW `0x818f10000–0x818f14000/3/1`, the first-path client present, flags `1/0/0`, and no App2 client. The RW mapping is now preserved (`rw_0x818f10000_14.00.bin`, SHA-256 `91b4101ded386a8c37c6c804758c9957f2c6e5d24b1050f9fa19d8fbaa1f485e`).

The official getter (`clone_history_syscore_official_get_v1`, command `b76235bb9a0040f7bcbb8f25b6c64777`) called `0x1bc0` on the browser's own first-path client object with the live PID. It returned `0x80AA000B` with output `0` and full restoration, without a warning. The app-info getter (`clone_history_syscore_appinfo_v1`, command `32555bae53764f35b3f8c5f699766963`) called `0x1cc0` with app ID `0`; it also returned `0x80AA000B` with a zeroed `0x48`-byte output. These controls show that the official read-only dispatch returned safely and make the hand-built raw `0x320` marshaling the leading differential. They do not prove that the earlier failure was a kernel panic or identify its cause.

The App2 two-thread discriminator was drafted, syntax-checked, and approved, but its worker could not be armed: the transferred-buffer object walk yields a non-butterfly at the message step on this boot (diagnostic capture `a2ee78b7dc294d6a8fd3f0a9c3d402d8`, `message_bytes` `008f010000260001`), so master/victim/leak cannot be located. Two arming attempts failed deterministically in page-local setup; **no App2 code executed**. The App2 hang-vs-death question therefore remains open, but App2 itself already warned three times at connect before any method, so the app-init gate is unreachable from this browser either way.

## Evidence

* [LNC status capture](../captures/8f23dc8f23024f2a90785b925b10504d.json)
* [Raw connect and control](../captures/970482ce9bcb4053b81dce3d81a2d639.json)
* [Session PID query and cleanup](../captures/4c5ef8b2ea904337aa8c0354de24c5e6.json)
* [Post-reboot SceSysCoreApp session failure](../captures/911755ecb7e44a76b599d34f2e8465ef.json)
* Claimed SceSysCoreApp2 warning command (markers: `7ac1ba0cffba4ba0b919242e7bec4a06`), no capture
* [Pinned LNC probe source](../probes/clone_history_ipmi_lnc_status_v1.js), source SHA-256 `c0741e296f30092609cbcd46f14aed8fd1182c707a52f48ea403ae47cadc402f`.
* Claimed SysCore getter command (markers: `87df422ba0974949a2c69bd67287b5ff`), no capture
* [Full evidence archive](../evidence/2026-10-21-ipmi-syscore-panic.zip), SHA-256 `b331bb32f2924013f526fcc80ff29cafa4c91508bf2fd058254835d614b42b98` (742 captures, 812 probe snapshots, 40 live artifacts).
* [Official getter capture](../captures/9ad47e4ec8094b549d7f2268fb2c67eb.json) (`0x80AA000B`, restored)
* [App-info getter capture](../captures/e0dca755caa348fcbe523e38475f0025.json) (`0x80AA000B`, zeroed output)
* [Fresh-boot baseline capture](../captures/41bf385e4fda48c1a59ec26af32b01fd.json) (VM map, client/flag region)
* [SysCore RW image](../evidence/live/rw_0x818f10000_14.00.bin), SHA-256 `91b4101ded386a8c37c6c804758c9957f2c6e5d24b1050f9fa19d8fbaa1f485e`
* [Full evidence archive](../evidence/2026-10-21-syscore-freshboot.zip), SHA-256 `c5b9cb7432c245d23b5dfb717fd418da73a776ed1b4b05416c741c32d4a75b30` (839 captures, 846 probe snapshots, 42 live artifacts).
