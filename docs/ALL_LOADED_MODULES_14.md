# All loaded PS4 14.00 browser modules: boundary audit

This audit covers every module in the browser PID 74 snapshot from page
`2119cf8f1a734dc5a6b964e8c2b1d3fb`. The [complete manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json)
contains 26 modules and 78 RX/RO/RW mappings. The reproducible
[screen](../tools/screen_all_modules.py) rehashed all 111,853,568 captured
bytes and combined each module's paths, service strings, and import links in
[module_screen.json](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/module_screen.json).
The [import graph](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/import_graph.json)
contains 3,377 candidate live thunks over 105 module edges. A string or
import is a lead, not proof that a call ran or crossed the sandbox.
The separate [all-module RX syscall scan](ALL_MODULE_SYSCALL_SCAN_14.md)
found no additional canonical fixed-number wrappers outside
`libkernel_web` in these 26 images.
The [all-module import map](ALL_MODULE_KERNEL_IMPORTS_14.md) also verified
186 import slots bound to ordinary `libkernel_web` wrappers, including
every module with zero direct wrapper imports. That map distinguishes a
bound entrypoint from an executed syscall.
The [broader path-literal screen](ALL_MODULE_PATH_SCREEN_14.md) checked
all 26 RX/RO images for device, system, user, and app-root paths; its
95 source locations add no independently demonstrated privileged route.

| Handle | Loaded module | What the captured browser code offers | Current 14.00 boundary finding |
| ---: | --- | --- | --- |
| 2 | `libSceLibcInternal.sprx` | Core allocation, C runtime and 126 kernel imports | General support. The source-mentioned `/dev/console` and `/dev/deci_tty6` paths returned `ENOENT` in a matched browser open census. [Record](DEVICE_PATH_CENSUS_14.md). |
| 16 | `libSceSysmodule.sprx` | Fixed-ID module loader, four `/dev/authmgr` ioctl clients, and a number-649 module-parameter query-shaped import | Its ID route builds table-owned paths. The 310-record table was decoded; loading the source-listed `libSceUserService` ID returned `0x80020002` with no new handle. Source-matched `/dev/authmgr` open returned `ENOENT` before any ioctl. The 649 callers inspect browser-local module parameter blocks; no cross-process effect. [Loader record](SYSMODULE_CLIENT_14.md), [import map](ALL_MODULE_KERNEL_IMPORTS_14.md). |
| 18 | `libScePosixForWebKit.sprx` | POSIX adapter; imports Net, Random and RegMgr | Its `SYSTEM_LANGUAGE` path calls a fixed RegMgr key. The corresponding read succeeded with value `1`; this is ordinary setting access. |
| 19 | `libcairo.sprx` | Graphics parser/rendering, PNG/font dependencies | Browser input surface, no service boundary lead in this screen. |
| 20 | `libcurl.sprx` | Network protocol and transfer support | Transport/parser surface; no sandbox crossing in the capture. |
| 22 | `libfontconfig.sprx` | Font discovery/configuration | Font input surface; no privileged service edge identified. |
| 23 | `libfreetype.sprx` | Font parsing and rasterization | Font input surface; no privileged service edge identified. |
| 24 | `libharfbuzz.sprx` | Text shaping | Browser input surface; no privileged service edge identified. |
| 25 | `libicu.sprx` | Unicode and locale implementation, largest support library | Parser/locale surface; no privileged service edge identified. |
| 26 | `libpng16.sprx` | PNG decoding | Image input surface; no privileged service edge identified. |
| 27 | `libSceIpmi.sprx` | Named cross-process IPC client | A live `SceSysCoreApp` session reached parent PID 38. Subsequent official getters returned `0x80AA000B`. Its synchronous raw packet was reconstructed and matched against live VideoCore and LNC methods; no unauthorized method effect. [Client](IPMI_CLIENT_14.md), [packet calibration](IPMI_RAW_METHOD_ABI_14.md). |
| 28 | `libSceSysCore.sprx` | SysCoreApp client and spawn-shaped method `0xaa110003` | Captured App client was uninitialized; no spawn call or process effect. [Record](SYSCORE_APP_CLIENT_14.md). |
| 29 | `libSceNet.sprx` | Socket wrappers and a BPF client, 53 kernel imports | Native TCP transport works. Source-matched `/dev/bpf0` open returned `ENOENT`, before any BPF ioctl. [Device gate](NET_DEVICE_GATE_14.md). |
| 44 | `libSceNetCtl.sprx` | Initialized `SceNetCtl` broker client | Of seven output-only methods, `0x20004` returned `3`; the other six returned `0x804121a1` with zeroed outputs. No authority effect. [Record](NETCTL_CLIENT_14.md). |
| 46 | `libSceRandom.sprx` | `/dev/rng` entropy client | Supporting service, no boundary lead. |
| 47 | `libSceLibreSsl3.sprx` | TLS/crypto implementation with Net and Random imports | Network parser/support, no privileged service edge identified. |
| 48 | `libSceRegMgr.sprx` | Registry syscall 532 client; keyed read and write wrappers | Command 0 returned `EPERM`; source-matched command `0x19` for the browser language key returned `0` and value `1`. Permission is selective; no write or escape shown. [Record](REGMGR_IMAGE_14.md). |
| 49 | `libSceSystemService.sprx` | LNC, RegMgr, IPMI and Mbus client; six RegMgr imports | App status succeeded through both the official wrapper and a matched raw packet; launch/list paths returned `0x8094000F`. The RegMgr callsites contain fixed setting keys, including clock-related code, but no setting write was attempted. Its source-matched `/dev/sbl_srv` open returned `ENOENT`. [Service](SYSTEM_SERVICE_IMAGE_14.md), [packet calibration](IPMI_RAW_METHOD_ABI_14.md), [device gate](DEVICE_PATH_CENSUS_14.md). |
| 58 | `libSceMbus.sprx` | `SceMbusIpc` client with many `0xce1100xx` methods | Live initialization returned `0` and state `2`. A guarded output-only method returned `0x809b00ff` with zeroed output; no authority effect. [Record](MBUS_AVSETTING_CLIENTS_14.md). |
| 59 | `libSceAvSetting.sprx` | `SceAvSettingIpc` client | Checked initializer returned `0x809a00ff` and left state `0`; no method was dispatched. [Record](MBUS_AVSETTING_CLIENTS_14.md). |
| 60 | `libSceVideoOut.sprx` | DCE and Dipsw device client; AvSetting and RegMgr imports | The checked initializer opened `/dev/dce`; a source-shaped output query returned `EPERM` with no data, then closed/reset. Four Dipsw getters returned ordinary zero values. [Record](VIDEOOUT_DEVICE_GATE_14.md). |
| 61 | `libSceVideoCoreServerInterface.sprx` | VideoCore broker and descriptor-passing path | `/system_tmp/SceKernelDescPassing` was absent (`ENOENT`). A generic IPMI client failed to connect, but the module's existing client was live: its session query returned peer PID 46 while the browser was PID 74. An output-only `0x12340017` request worked through both its wrapper and a matched raw packet; the output changed on successive calls. No authority effect was demonstrated. [Record](VIDEOCORE_CLIENT_14.md), [packet calibration](IPMI_RAW_METHOD_ABI_14.md). |
| 72 | `libSceNKWebKitRequirements.sprx` | PS4 browser/platform adapter with kernel, RegMgr, ICU and SlimGL imports | Its root-certificate and Boolean RegMgr keys returned status `0x800d0203`; no setting value or authority effect. [Record](REGMGR_IMAGE_14.md). |
| 73 | `libSceNKWebKit.sprx` | WebKit engine, 61.4 MB RX | The History bug gives current-process native read/write and code-reuse execution. This is the achieved browser execution stage, not a sandbox escape. [Progress](PROGRESS.md). |
| 83 | `libSceGLSlimClientVSH.sprx` | SlimGL IPC client, importing SystemService and Sysmodule | The known setup route converges on the denied SystemService launch path; no separate crossing confirmed. |
| 8193 | `libkernel_web.sprx` | Browser kernel-wrapper library, 293 measured ordinary wrappers | Used for verified native calls and syscall readback. Ten device paths embedded in this image returned `ENOENT`; `/dev/random`, `/dev/rng`, and `/dev/dmem0` opened and closed in the same page. The library supplies a bridge to the kernel's policy checks, not permission to bypass them. [Map](LIBKERNEL_WEB_MAP_14.md), [device census](DEVICE_PATH_CENSUS_14.md). |

The service-side shortlist from **this** 14.00 snapshot is the initialized
NetCtl/IPMI clients and SystemService's broker calls. VideoCore's live
peer and output-only method are confirmed, but the browser adapter uses
that library primarily for media streams and playback status; it has no
observed authority effect. RegMgr's language
key is permitted but the browser-adapter keys returned an application
error; Sysmodule's AuthMgr and Net's BPF device paths returned `ENOENT`.
Mbus, AvSetting, SysCore and VideoOut expose
interesting client code. Mbus now has a connected browser client, though
its first output query failed; AvSetting initialization failed. SysCore
and VideoOut still have the gates described in their records. The large
WebKit/media/network libraries are still in the inventory; their parser
surfaces matter for a *new browser bug*, while this goal already has a
browser-native primitive and needs a separate authority effect.

Focused [SystemService broker callsites](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/system_service_broker_selected.txt)
show that its IPMI imports construct or connect named clients, including
`SceLncService`; those links do not expose a new server implementation.
Two Mbus imports are called with fixed lifecycle arguments `(1,0,1,0)`
and `(1,0,1,1)`. Although the original mapped snapshot had a zero client
pointer, the live initializer later established state `2` and a client.
The first checked broker query returned `0x809b00ff` with zeroed output.
That result narrows this route to a reachable client with an unresolved
method error, pending a source-defined request with an independent effect
oracle. [Exact calls and limits](MBUS_AVSETTING_CLIENTS_14.md).
The browser adapter's third SystemService import targets
`sceSystemServiceKillLocalProcess`, identified in the
[14.00 callee](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/system_service_third_requirement.txt).
Its [media-backend caller](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/requirements_systemservice_selected.txt)
first fetches an app-status record, takes its first word as the local
process identifier, then passes that identifier and its own input to the
kill wrapper. This is a cleanup route paired with the existing
launch/status imports, not evidence of arbitrary cross-process control.
No kill call was dispatched from the research page.

A separate [source-string trace](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/system_service_device_refs.txt)
identified SystemService RX+`0x28110` as a direct
`open("/dev/sbl_srv", 2)` client. Its [14.00 open check](DEVICE_PATH_CENSUS_14.md)
returned `ENOENT`, so no follow-on device operation was reachable by that
path in this browser view. The [ten-path census](DEVICE_PATH_CENSUS_14.md)
also found only `ENOENT` for other `libkernel_web`/libc diagnostic and
hardware paths, with live `/dev/random`, `/dev/rng`, and `/dev/dmem0`
opens confirming the same-page call setup. These are absence results for
tested names, not global claims about the hardware services.

The screen verifies complete mapped bytes and structurally classifies
every module. It does not claim exhaustive decompilation of 111.9 MB or
coverage of the privileged server/kernel implementations, which are not
mapped in this process. The next useful test must specify a 14.00 client
contract, a current-page byte check, and an independently observable
permission or protected-resource result.

The follow-on [LNC method map](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/lnc_request_map_annotated.json)
indexes all 76 SystemService wrappers and correlates 72 with source-named
internal callers. It distinguishes ordinary status requests from
launch, kill, suspend, and explicit `crashSyscore` calls. The source-
defined `getGpuCrashFullDumpAppStatus` output-only read has now run on a
fresh page alongside two status-list methods. All three returned
`0x8094000F` with no protected data.
[Exact packet, captures and limit](LNC_SHELLUI_REBOOT_LIST_14.md).

The [audit evidence archive](../evidence/2026-10-23-all-modules-v11.zip)
contains 1,843 captures, 1,515 probe snapshots, 27,529 live artifacts,
and an integrity-checked SQLite backup. All 30,888 manifest members
verified; ZIP SHA-256 is
`80f3b282aa06663efea96b7b622d865e10b66a2af7d6badf14930222e95398bd`.
