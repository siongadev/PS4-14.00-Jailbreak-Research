# System-service symbol-resolution gate on PS4 14.00

Updated 2026-10-20. The live [module inventory](LIVE_MODULE_INVENTORY_14.md) found `libSceSystemService.sprx` at handle `49` and `libkernel_web.sprx` at handle `8193`. [Native caller v11](../captures/2244778253a8488b94f3464488924c4d.json) byte-checked the current number-591 wrapper, 17 other wrappers, and ten code gadgets; four PID controls passed with state restored. The older [PS4 SDK](https://github.com/CTurt/PS4-SDK/blob/master/libPS4/source/module.c) supplied a candidate `sys_dynlib_dlsym(handle, name, outPointer)` call shape, but its export availability is not evidence for this 14.00 build.

The [first two-name query](../captures/cc1b7d4984554e2a9cd9e8ad93f1d8a9.json) returned `-1` and same-thread errno `3` for both `sceSystemServiceParamGetInt` and `sceSystemServiceLoadExec`. Its owned output guard and browser pointers were restored. A revised comparison initially stopped at the collector's 32-character marker limit **before any native call**; that [rejected-marker capture](../captures/1ef2f211d0c24f0d8ac5bdbd9c243264.json) provides no syscall result. The corrected [matched comparison](../captures/b62c1c9494ac49048c1a8816dc1403b2.json) again returned `-1`/errno `3` for `sceSystemServiceParamGetInt` and `sceSystemServiceLaunchWebBrowser`, and returned the **same** result for the known historical `sceKernelOpen` name in `libkernel_web`. It restored the guarded owned frame after each call.

The equal failures mean this name-based syscall route has not established either system-service export on 14.00. They do not prove the exports are absent: the handle convention, symbol namespace, or caller policy may differ from the old SDK. No resolved address was used for a function call, and no service or sandbox effect occurred. Further device tests should derive a symbol or callsite from the current live module bytes or a validated 14.00 import, rather than cycle through historical names. A separate ordinary control and an independent cross-process authority oracle are still required for an escape claim.

On 2026-10-23, a follow-up also tried NIDs rather than plaintext. It
first verified libkernel handle `8193` in the current module list, then
queried the published NIDs for `sceKernelOpen` (`1G3lF1Gg1k8`) and
`sceKernelAvailableFlexibleMemorySize` (`aNz11fnnzi4`). Both returned
`-1`/`ESRCH`, matching the plaintext `sceKernelOpen` control, with
guards and owned bytes restored. [14.00 capture](../captures/d3fba2f7f9154d9da4ea85ed5b32dd38.json).
This closes the simple NID substitution on this page; it does not
establish why the linker denied each lookup.
