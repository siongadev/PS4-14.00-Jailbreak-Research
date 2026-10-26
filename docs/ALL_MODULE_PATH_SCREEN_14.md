# PS4 14.00 path-literal screen across all loaded modules

The [reproducible scanner](../tools/scan_all_module_paths.py) verified
the RX and RO hashes of every one of the 26 browser-loaded modules and
recorded 95 path-shaped ASCII occurrences in the
[full result](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/module_path_literals.json).
Each record includes its module, mapped segment, and segment-relative
offset. Thirteen modules contain no matching literal. This is a static
string screen: dynamically built names, other path roots, and code in
the privileged server or kernel are outside its scope.

The paths with a possible boundary implication were checked against the
14.00 client code and prior live results:

| Modules | Newly visible path family | Assessment |
| --- | --- | --- |
| `libSceSystemService` | `/system/priv/etc/timezone.dat`, `/system_data/priv/settings_app/timezone.dat.env`, `/user/system/etc/timezone.dat` | Its captured timezone parser opens and reads these files from the **browser-loaded client**. These are not a separate privileged broker read in this image. No controlled path or protected-data result was demonstrated. [Decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/system_service_regmgr_selected.txt). |
| `libSceNet` | `/data/sce_net_captures/`, `/hostapp/sce_net_captures/`, `/dev/notification4` | Debug/network-capture path literals; the source-matched BPF node `/dev/bpf0` already returned `ENOENT`. No capture path was invoked on the console. [Device gate](NET_DEVICE_GATE_14.md). |
| `libSceSysmodule` | `/common/lib/`, `/common_ex/lib/`, `/app0/sce_module/` | Loader path templates built from table-listed IDs; the matched direct load tests for standard `libkernel.sprx` and `libc.sprx` returned `ENOENT`. [Loader record](SYSMODULE_CLIENT_14.md), [libkernel map](LIBKERNEL_WEB_MAP_14.md). |
| `libSceLibreSsl3`, `libfontconfig` | Certificate and font paths | Ordinary supporting data inputs; no privileged service client or permission effect is established by these strings. |
| `libSceGLSlimClientVSH`, `libSceNKWebKit`, `libSceNKWebKitRequirements` | `app0`/`hostapp` process and adapter paths | Process-image or app-root references; the tested Web App launch returned `0x8094000F` without a new PID. [Launch gate](WEBAPP_LAUNCH_GATE_14.md). |
| `libSceVideoCoreServerInterface` | `/system_tmp/SceKernelDescPassing` | The node was absent from the browser-visible directory and a source-shaped connection returned `ENOENT`. [VideoCore record](VIDEOCORE_CLIENT_14.md). |
| `libkernel_web`, `libSceVideoOut` | Device nodes | The working DCE/Dipsw and denied/absent device tests are recorded in the [device census](DEVICE_PATH_CENSUS_14.md) and [VideoOut gate](VIDEOOUT_DEVICE_GATE_14.md). |

The broader path inventory found no new live server image or source-backed
path that independently grants a protected operation. A string is not a
permission result; further work needs a caller contract and a live
authority oracle.

The verified [v9 archive](../evidence/2026-10-23-all-modules-v9.zip)
preserves this path index beside the complete dump and live captures;
SHA-256 is
`d634639274b490085e840ab7b89b87b1531f79e12d4755333ee097e8df88bec2`.
