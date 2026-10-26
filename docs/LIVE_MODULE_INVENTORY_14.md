# Loaded modules in the PS4 14.00 browser process

Updated 2026-10-20. This inventory was obtained from session `70f88a40719c4399a366ad3e30265d84` after the browser's native-call path rechecked 17 current-process wrapper signatures and ten gadget signatures. The [installer capture](../captures/3c151086524c40c0933ab16524d4c673.json) returned four consecutive PID `145` controls and restored its temporary pointers. The names and handles below are **14.00 device observations**. The older [PS4 SDK module-list and module-info definitions](https://github.com/CTurt/PS4-SDK/blob/master/libPS4/source/module.c) provided only the call-shape hypothesis; each live call determined whether it worked here.

The byte-checked number-592 call returned zero and reported 27 handles in a 64-entry guarded output array. Its output guard and owned frame were restored. [Module-list capture](../captures/2322f3d7b99b465a85444c852d1617f5.json). Number 593 then returned a name for handle `8193` in a guarded `0x160`-byte record; its code-base and code-size fields were zero. [Single-handle capture](../captures/2438659443534ddcaa724af8544213ad.json). Four further commands queried at most seven handles each, with guard and frame restoration after every call: [batch 0](../captures/0088271122ef48d8aad68e45d43e6e8b.json), [batch 1](../captures/b7f112cf0bb74378bc4b0f4cb7626e67.json), [batch 2](../captures/5d75a3de31794c5894b0d4899106d17e.json), [batch 3](../captures/ce577796da404b52a30c45f0b57a5375.json).

| Handle | Returned name |
| ---: | --- |
| 0 | `NKWebProcess.self` |
| 8193 | `libkernel_web.sprx` |
| 2 | `libSceLibcInternal.sprx` |
| 16 | `libSceSysmodule.sprx` |
| 18 | `libScePosixForWebKit.sprx` |
| 19 | `libcairo.sprx` |
| 20 | `libcurl.sprx` |
| 22 | `libfontconfig.sprx` |
| 23 | `libfreetype.sprx` |
| 24 | `libharfbuzz.sprx` |
| 25 | `libicu.sprx` |
| 26 | `libpng16.sprx` |
| 27 | `libSceIpmi.sprx` |
| 28 | `libSceSysCore.sprx` |
| 29 | `libSceNet.sprx` |
| 44 | `libSceNetCtl.sprx` |
| 46 | `libSceRandom.sprx` |
| 47 | `libSceLibreSsl3.sprx` |
| 48 | `libSceRegMgr.sprx` |
| 49 | `libSceSystemService.sprx` |
| 58 | `libSceMbus.sprx` |
| 59 | `libSceAvSetting.sprx` |
| 60 | `libSceVideoOut.sprx` |
| 61 | `libSceVideoCoreServerInterface.s` (32-byte field truncated) |
| 72 | `libSceNKWebKitRequirements.sprx` |
| 73 | `libSceNKWebKit.sprx` |
| 83 | `libSceGLSlimClientVSH.sprx` |

The handle-zero name independently ties the small captured [live RX image](LIVE_PROCESS_IMAGE_14.md) to `NKWebProcess.self`. The WebKit and system-service module names also confirm that their code is loaded in this process; they do **not** prove that a specific export can be called from a page, that its arguments cross a privilege boundary, or that the sandbox can be escaped. A [follow-up name-resolution gate](SYSTEM_SERVICE_SYMBOL_GATE_14.md) returned the same error for historical system-service names and a libkernel control, so no export address was established. The next interface test needs a 14.00-derived symbol or callsite, a measured call contract, an ordinary control, and an independent authority oracle. A successful module-list query or an address alone does not pass that test.
