# 14.00 SysCore app IPC client and spawn-shaped method

Updated 2026-10-21. This record uses the live 14.00 browser process and its loaded `libSceSysCore.sprx`. The client code is captured; **no spawn method has been called**. After a full power cycle (PID `65`), the official `0x1bc0` getter and `0x1cc0` app-info getter each returned `0x80AA000B` cleanly; the App2 app-init gate is unreachable because every App2 connection attempt warns before any method.

## Module and client

The module inventory names handle `28` `libSceSysCore.sprx`. On the post-crash page session `39438712bb284c2f83424d158221d66d` (browser PID `67`), its module-info-ex record returned the same name and a `0x8000`-byte RX entry at `0x81b340000`; the measured VM map shows RX `0x81b340000-0x81b348000`, RO `0x81b348000-0x81b34c000`, and RW `0x81b34c000-0x81b350000`. The RX bytes are [preserved](../evidence/live/rx_0x81b340000_14.00.bin), SHA-256 `c45cb886410dcb33b3f63d0db1632a5f0f02c765ed6ad8b37a192b9b151027c7`; the RO table is [preserved](../evidence/live/ro_0x81b348000_14.00.bin), SHA-256 `2c22699fb79f283ba66da174b42e10d7e7c3e7b67803ff4447cc26ff8a199e38`. The RO mapping contains pointer tables but no symbol-name strings; name-based `dynlib_dlsym` for ten `sceApplication*` names returned `-1`/errno `3`.

The RX image contains `SceSysCoreApp`, `SceSysCoreApp2`, `SceSysCoreEventSemaphore`, and the build path `W:\Build\J02699045\sys\internal\syscore\app\app_ipc_client.cpp` with assertion strings. Public PS4LibDoc/SDK data identifies the module’s exported `sceApplication*` family, including `sceApplicationInitialize`, `sceApplicationAddProcess2`, `sceApplicationExitSpawn`, `sceApplicationGetProcs`, and kill/focus helpers. Those names are API guidance, not live symbol matches.

## Method ranges

The client code contains sequential sync-method IDs:

* `0xaa110000` through `0xaa110024` (37 methods) in the first client path.
* `0xaa120000` through `0xaa120021+` in the second client path; the second path uses a C++ virtual call rather than the first path’s common send wrapper.

The first four methods and their live argument shapes are:

| Method | RX function | Input | Output | Inferred role |
| --- | --- | --- | --- | --- |
| `0xaa110000` | `0x1bc0` | one 4-byte value | 4 bytes | getter/query (possibly `GetAppId`) |
| `0xaa110001` | `0x1c40` | one 4-byte value | 4 bytes | getter/query |
| `0xaa110002` | `0x1cc0` | one 4-byte app ID | `0x48` bytes | app-info getter; consistent with `GetAppInfoByAppId` |
| `0xaa110003` | `0x1d40` | **five inputs** (below) | 4 bytes | spawn/add-process-shaped; consistent with `AddProcess2`/`ExitSpawn` |

The `0xaa110002` shape (one 4-byte input, one 72-byte output) and the `0xaa110003` shape are direct observations from the client code, not from an API header.

## The `0xaa110003` spawn-shaped call

At RX `0x1d40`, before the call, the client builds five input descriptors and one 4-byte output:

1. 8-byte input containing the function’s 32-bit argument and another 32-bit argument.
2. A NUL-terminated string argument; its descriptor size is `strlen + 1`.
3. A caller buffer pointer and a caller-supplied size.
4. An 8-byte input from a stack argument.
5. A **`0xc40`-byte (3,136-byte) structure** from a stack argument.

It then sets method `0xaa110003`, `numInData = 5`, one 4-byte output buffer, and calls the client’s `invokeSyncMethod` path. The path string and the 0xc40 structure match the shape of the system core app’s process-launch client: public kernel logs for `SceSysCore.elf` show `processSpawn(pid, appId, ..., appParam, processParam, ...)`, then `appParam` fields (`appType`, `rootPath`, `titleId`) and `processParam` fields (`elfPath`, `fullPath`), followed by `new pid=` and `Ready to exec`.

**Inference:** this is the client that asks the system core app to create a process/app. It is not proof that the browser may set an arbitrary path, that the server skips signature or app-DB checks, or that a launched process escapes the browser sandbox. The 0xc40 structure and the string/path fields remain unverified server-side.

## Live boundary state

Before the crash, on session `70f88a40719c4399a366ad3e30265d84` (browser PID `145`), a raw `ipmimgr_call` connect with the client name `SceSysCoreApp` returned `0`. Its destroy returned `EBUSY`, a session-PID query returned PID **38** (the browser’s parent), and an explicit disconnect/destroy pair closed it cleanly. That session was read-only: **no method was invoked**. The matched nonexistent-name control returned `ESRCH`.

The later `SceLncService` status attempt returned `ESRCH` and the console stopped; the reboot reported **CE-36329-3** (“system software” error). After the reboot, on session `39438712bb284c2f83424d158221d66d`, the `SceSysCoreApp` client connected but the session-PID query failed (`session_pid_unavailable`), so no getter ran. A session-only attempt with `SceSysCoreApp2` produced a browser memory warning and a page refresh; the command remains claimed with only the `syscore_info_preflight` marker. **The post-crash IPMI server state is degraded; do not retry either name on this boot.**

## Offline state-machine finding (2026-10-22)

The `0x80AA000B` getter failure is a **client-side** state check, not a server response. In the preserved RX (base `0x81b340000`), the first-path invoke guard at `0x5e0` requires two module bytes, `+0xC088 == 1` and `+0xC089 == 1`, before it dispatches; otherwise it returns `0x80AA0004` or `0x80AA000B` without IPC. The browser's RW image and the fresh-boot baseline capture (`41bf385e…`) show `+0xC088=1`, `+0xC089=0`: the library is initialized, the application context is not. The library-mode constructor at `0x1e0` sets exactly that state.

The app-init-shaped function at `0x3a0` first checks `+0xC088 == 0`; with `+0xC088=1` it returns `0x80AA0003` immediately. If forced, it calls the App2 method `0xaa120012` through the wrapper at `0x38d0` with the global client pointer at `+0xC060`. Both the fresh-boot RW image and baseline capture show `+0xC060 = 0` (the baseline records `app2_client: 0`), so that call would dereference null, not reach a server. The App2 client has to be created by the separate path that already warns.

**Consequence:** the official getter never contacted the server; `0x80AA000B` is a local "library mode, no app context" result. Forcing `+0xC088=0` and calling `0x3a0` is a predictable WebProcess null-deref, not a safe bypass. The App2 client-creation path remains the only way to change the flags, and it is the path that warns. Do not force the flag. This closes the first-path app-context route without a new device crash.

An additional offline check closes the tempting one-byte alternative of
setting `+0xC089=1` directly. The preserved RX at `+0x6f6` loads the
client pointer from module offset `+0xC060`, then calls `+0x2e10` at
`+0x737`; that callee dereferences the passed pointer at `+0x2f12`.
The preserved fresh-boot RW image has `+0xC088/+0xC089=1/0` and the
pointer at `+0xC060=0`. The [offline verifier](../tools/check_syscore_mode_gate.py)
hash-checks both original images and these instruction bytes. Bypassing
only the second guard would therefore reach a null client, not a
working first-path IPC call. This is a static prediction from the captured
browser code and RW snapshot; the unsafe flag mutation was not run.

Live confirmation (capture `fb32e106`, 2026-10-22): SysCore base `0x81bb98000`, flags `1/0`, App2 client `0x0`, and the RX signatures at `0x1e0/0x3a0/0x5e0` match the preserved image. The fixed worker App2 discriminator then ran cleanly (capture `65ebf96e`, session `4817d398`): client create returned `0` (kid `58950`), the raw connect returned `-1` with worker-thread errno **`3` (ESRCH)**, `connect_hung=false`, no memory warning, and full page/worker restoration. The `SceSysCoreApp2` server name does not exist on this boot; the first-path `SceSysCoreApp` server does. App2 app-init `0xaa120012` is unreachable, so the first-path getters stay in library mode and `0xaa110003` remains gated. **App2 is closed; do not retry.** Earlier v2–v7 attempts were worker-heap failures; v10/v11 fixed the anchor (`storage+8`) and the `!wired` callback ordering.

## Next gate

1. The official first-path getter and app-info getter now return `0x80AA000B` cleanly on a fresh boot; the read-only dispatch path is proven safe and the earlier panic is blamed on raw marshaling.
2. The app-init gate is the App2 `0xaa120012` method. The fixed worker run created the App2 client (kid `58950`) but the raw connect returned `-1` with errno **ESRCH (3)**: the `SceSysCoreApp2` server does not exist on this boot. The first-path `SceSysCoreApp` server does. App2 app-init is unreachable; the first-path getters stay in library mode and `0xaa110003` stays gated. **App2 is closed; do not retry.**
3. The `0xaa110003` spawn stays gated: the app context is uninitialized (`0x80AA000B` on all first-path reads), the `0xc40` structure is unverified server-side, and there is no authorized session. Do not call it.
4. A process-launch result is a boundary observation only if an independent effect shows the new process running outside the browser’s authority. The current evidence does not establish that.

## Direct connected-client comparison on 2026-10-23

On a freshly calibrated 14.00 browser page (PID `72`), the current
`libSceIpmi` and `libSceSysCore` bases were obtained from live module
records and their function entries byte-checked. A new owned IPMI client
connected to `SceSysCoreApp` (`connect=0`, status `0`). Calling the
module's read-only `0xaa110000` getter at RX+`0x1bc0` through that
client returned `0x80AA000B` for input PID `72` and for input `0`, each
with output word `0`; both runs cleaned up and restored browser state.
[PID-input capture](../captures/604566d7f2dc42c28cb5d731ffd0d72d.json),
[zero-input capture](../captures/a3f4231aa85b40f9a9b6a22c90fcc82a.json).
The similarly byte-checked app-info getter at RX+`0x1cc0`, method
`0xaa110002`, returned the same code for app ID `0` through a fresh
connected client ([capture](../captures/02807822151b4091bf76dee007e28442.json)).
The adjacent getter at RX+`0x1c40`, method `0xaa110001`, also returned
`0x80AA000B` for input `0`, with output word zero, cleanup, and browser
state restoration ([verified capture](../captures/567b324d23054b44be1a5eea9381b4aa.json)).

An otherwise matched client named `Fw14NoSuchSvc` failed to connect and
its getter returned `0x80020003` with the `0xA5A5A5A5` output sentinel
untouched ([control capture](../captures/761d054ef7374f36941ec2467b4c064e.json)).
The different connected and unconnected results show that the connected
getter passed the local library-mode guard and reached a distinct method
path; the captured SysCore getter and IPMI client RX code do not contain
an immediate `0x80AA000B` in that direct call path. The exact producer
of the connected result is not yet proven, but a server-side
not-initialized response is consistent with it. There was no process
launch, app data, privilege change, or sandbox escape. These two getter
IDs should not be replayed with more arbitrary integers on this boot.

## Separate ShellCore service-name check

`SceShellCoreUtil` occurs in the live 14.00 `libSceSystemService` RX
image, but its role as an IPMI server name was unproven. A new owned
client was created successfully and the raw connect was attempted with
that name. The first attempt produced no result after the preflight
marker; the operator saw a browser memory warning. A fresh page was
fully recalibrated (PID `73`) and the second, source-pinned check added
markers after client creation and immediately before and after connect.
The collector received `shell_create_done` and `shell_connect_before`,
then polling stopped with no after-connect marker or capture; the
operator again saw a memory warning. [First command](../probes/clone_history_shellcore_connect_v1.json),
[marked repeat](../probes/clone_history_shellcore_connect_v2.json).
Neither run proves the server exists or that the connect reached it.
This exact name/connect shape should not be replayed without a new
isolation or diagnostic path.

## Limits

The RO/RW mappings contain no recoverable export names; the API-name mapping above is a code-shape inference. The live client RX/RO dumps are from PID 67 and are process-specific; the RW dump and fresh-boot baselines are from PID 65. No spawn request was ever sent. The CE-36329-3 crash is separate; the fixed worker run's App2 connect returned ESRCH cleanly (errno 3); earlier warnings were worker-heap failures, not the server. The 0xc40 structure’s fields, the server’s validation, and any app-signature or title-ID check are unknown. No sandbox escape, credential change, protected-resource access, or kernel effect has been demonstrated.
