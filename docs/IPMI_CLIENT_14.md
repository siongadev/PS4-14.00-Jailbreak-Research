# 14.00 IPMI client and name interface

Updated 2026-10-20. These observations use the same retail 14.00 session `70f88a40719c4399a366ad3e30265d84` and browser PID `145`. They extend the [IPMI image record](IPMI_IMAGE_14.md) with byte-checked calls into the loaded `libSceIpmi` code. They do **not** show a server connection, a session, a privileged method, a cross-process effect, or a sandbox escape.

## Live API map

The public SDK stub [diff](https://git.etawen.dev/EchoStretch/sdk/commit/6ddfee92f419c8f5339646d2721310e6c8f5ea67.diff) supplies mangled names such as `IPMI::Client::create(IPMI::Client**, IPMI::Client::Config const*, void*, void*)` and `IPMI::impl::SessionImpl::isPeerPrivileged()`. Those names are hypotheses about the ABI until matched to live bytes. Each probe below checked the first 16 bytes of every target in the current process before calling it and restored the modified browser pointers afterward.

| Live offset | Function | Derivation |
| --- | --- | --- |
| `0x833f011b0` | `IPMI::Client::Config::Config()` | Initializes sync/async limits; `[+0x20]=1`, `[+0x28]=0xf00`, `[+0x38]=1`, `[+0x1c]=0`, name byte `0`. |
| `0x833f01230` | client storage estimate | Returns `0x1000`; used as the owned storage size. |
| `0x833f01300` | `IPMI::Client::create` | Checks output and storage, constructs at storage, calls the client initializer, stores the object pointer on success. |
| `0x833f00630` | `ClientImpl::destroy` | Reads the client kid at `[this+8]`, calls the destroy wrapper, then clears the kid on success. |
| `0x833f054f0` | `sceIpmiMgrGetClientName`-style wrapper | Kernel operation `0x46b`, arguments `(kid, char *name)`. |
| `0x833f05470` | `sceIpmiMgrGetServerName`-style wrapper | Kernel operation `0x46a`, arguments `(kid, char *name)`. |
| `0x833f00710` | `ClientImpl::connect` | Kernel operation `0x400`; **not called** in these runs. |

The 16-byte signatures, owned config/storage addresses, and call chain are pinned in the probes. The [RO vtable table](IPMI_IMAGE_14.md#adjacent-mappings) places `destroy` at `0x630`, `connect` at `0x710`, and the sync/async method wrappers at `0x8d0`/`0xcd0`.

## Device results

| Probe | Capture | Result |
| --- | --- | --- |
| Create one client named `Fw14NoSuchSvc`, then destroy it | [`3194fb48970047b0b038a1b90fa3db66`](../captures/3194fb48970047b0b038a1b90fa3db66.json) | `create=0`, output equals storage, kid `26191`, `destroy=0`, PID `145` before and after, all scratch and native-chain bytes restored. |
| Create `Fw14NameProbe`, query its name, scan 64 kids for server/client names | [`0a2d710893b946e193042a28b5a26faa`](../captures/0a2d710893b946e193042a28b5a26faa.json) | Own name returned exactly; 64 sampled kids produced **zero** server or client names. |
| Two live clients `Fw14ProbeA`/`Fw14ProbeB`, cross-query names, then destroy both | [`e1e477d3a4ea48b09fac392c47bbb406`](../captures/e1e477d3a4ea48b09fac392c47bbb406.json) | Kids `42575` and `9774`; both names readable; `name_a_after_b=Fw14ProbeA`; `GetServerName(client kid)` returned `0x80020002`; `destroy=0/0`; full restoration. |
| Connect one client to the nonexistent name `Fw14NoServerSvc` | [`22ce585c559647bc9ae87e0e2042a0de`](../captures/22ce585c559647bc9ae87e0e2042a0de.json) | `create=0`, kid `26167`, `connect_return=0x80020023`, status `0`, retry `0`, `destroy=0`, PID `145` before/after, full restoration. The public [PS4 error table](https://www.psdevwiki.com/ps4/Error_Codes) names `0x80020023` `SCE_KERNEL_ERROR_EAGAIN`; Sony kernel semantics are not inspected. No server response or session was observed. |
| Raw syscall connect control to nonexistent `Fw14RawSvc` | [`970482ce9bcb4053b81dce3d81a2d639`](../captures/970482ce9bcb4053b81dce3d81a2d639.json) | Raw syscall 622 returned `-1` with errno `3` (`ESRCH`) on the first call; client kid `17949`; destroy `0`. A clean no-such-server control. |
| Raw syscall connect to `SceSysCoreApp` | [`970482ce9bcb4053b81dce3d81a2d639`](../captures/970482ce9bcb4053b81dce3d81a2d639.json) | Raw syscall 622 returned **`0`** on the first call; client kid `58928`; a subsequent destroy returned **`0x80020010` (`EBUSY`)** because the client remained connected. |
| Session-PID query and cleanup of kid `58928` | [`4c5ef8b2ea904337aa8c0354de24c5e6`](../captures/4c5ef8b2ea904337aa8c0354de24c5e6.json) | `getSessionPidByClientKid` returned `0` and PID **`38`**; disconnect returned `0`/status `0`; destroy then returned `0`; PID `145` unchanged and all carrier/scratch/native-chain bytes restored. |

All three captures pass `python -m fw14lab.verify`. The two-client probe proves that a client object in this process can query another client's name by kid while both are alive. The server-name getter rejects a client kid with `0x80020002`, which is a working negative control for the object-type check. The four observed kids (`26191`, `34384`, `42575`, `9774`) show no sequential or low-bit pattern, so a bounded kid scan is unlikely to reach another process's object; no foreign object was observed in the 64-kid sample.

## What this does and does not show

**Shown.** The browser process can create and destroy kernel IPMI client objects with an arbitrary, caller-chosen name, read the resulting client kid, query client names by kid, and enter the connect syscall. Same-process cross-client name reads succeed. The nonexistent-name connect returned `0x80020023` (`SCE_KERNEL_ERROR_EAGAIN` in the public table) immediately with no session and full cleanup. A direct call through the measured `ipmimgr_call` syscall wrapper (syscall 622) produced a clean `ESRCH` for a nonexistent name but **success (`0`) for `SceSysCoreApp`**. The resulting client could not be destroyed (`EBUSY`), a session-PID query returned **PID 38**, and an explicit disconnect followed by destroy returned `0/0`. The calls are ordinary local IPMI object management except for the session, which is a real cross-process channel; every run reported unchanged browser PID and restored browser pointers and scratch bytes.

**Not shown.** No server method was invoked, no event flag or message queue was used, and no foreign-process memory or authority was read. The session was cleanly closed. The kernel's IPMI implementation and method-dispatch policy were not inspected. PID 38 is also the browser's parent in the [process-boundary record](PROCESS_BOUNDARY_MODEL_14.md); the session therefore reaches the browser's system parent over a documented-looking IPC path, not an arbitrary third process. A session is not an escape: the server may restrict methods by client identity or app ID, and no method result or privileged effect has been observed. The name query is not evidence that the browser can see another process's IPMI objects; the 64-kid scan is a bounded negative sample. Creating a client with a privileged-sounding name does not grant a privilege by itself.

## Live session to the system core

The raw syscall path gave a sharp control comparison. The client named `Fw14RawSvc` got `ESRCH`, while the client named `SceSysCoreApp` got `0` from the same `connect` operation. Destroying the latter returned `EBUSY`; the session-PID query then returned **38**, and an explicit disconnect/destroy pair closed it. In the [process-boundary record](PROCESS_BOUNDARY_MODEL_14.md), PID 38 is the browser's parent, and an earlier `kill`/`sigqueue` to that PID was denied with `EPERM`. The IPMI path therefore demonstrates a different, accepted channel to the same privileged parent.

This is the strongest boundary observation in the project so far, but it is **not** yet an escape. The parent may deliberately accept IPMI clients from its browser child and may restrict method dispatch to a safe subset. The observed session was read and closed; no method, file, process, credential, jail, or kernel effect was produced.

## Next gate

Method invocation is the next device step. The public RPCSX source lists emulator-side IPMI server names and method IDs; those names and IDs are hypotheses, not Sony 14.00 behavior. Relevant starting points are `SceLncService` status `0x30013` (read-only) and load-exec `0x30010`, `SceUserService` `0x30011`, and `SceSaveData` `0x12340000`-series. The `SceLncService` load-exec handler in that source treats a three-buffer request whose second buffer is `"EXIT"`; **do not send `"EXIT"`** to a live shell service.

1. First invoke the read-only `SceLncService` status method `0x30013` on a fresh `SceLncService` client and read the 12-byte response. This tests method dispatch and output handling on a privileged server without changing authority.
2. Only then investigate the exact input format and authorization of load-exec `0x30010` from public headers or a captured client. A launch request is a privileged action and may disturb the shell; do not guess an action string or path.
3. Keep the session bound to the client the probe created, and always disconnect and destroy it. Do not call methods on a foreign session.
4. A sandbox-escape claim still requires an independent authority or out-of-process effect, such as a launched process running outside the browser's sandbox, not merely a successful IPMI method.
