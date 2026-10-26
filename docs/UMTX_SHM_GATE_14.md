# 14.00 UMTX operation gates

Updated 2026-10-20. [FreeBSD-SA-24:14.umtx](https://www.freebsd.org/security/advisories/FreeBSD-SA-24:14.umtx.asc) describes a shared-memory registration lifetime bug reached through `UMTX_OP_SHM` with concurrent destroy requests. This is an upstream candidate, not evidence that Sony 14.00 has the implementation. The [current FreeBSD header](https://raw.githubusercontent.com/freebsd/freebsd-src/main/sys/sys/umtx.h) assigns operation `25` to `UMTX_OP_SHM`, with read-only `LOOKUP=2` and `ALIVE=8` flags; the [older FreeBSD 9 header](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/umtx.h) ends before operation `25`. Sony's fork may differ from either source.

The 14.00 [wrapper census](../captures/0d7687b41f104aada204059eb3ef9c64.json) contained number `454`, which the [FreeBSD 9 syscall list](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/syscall.h) names `_umtx_op`. A new [page caller](../captures/06df4e2e3a694a098580d3629e26f2a2.json) byte-checked the live number-454 wrapper and existing code-reuse gadgets before running four benign process-ID controls. Each subsequent call used one owned frame mapping and recorded the same thread's errno, output-word shape, and unchanged guard.

| 14.00 call | Return | Errno | Capture |
| --- | --- | --- | --- |
| Invalid operation `127`, null address | `-1` | `22` (`EINVAL`) | [ALIVE comparison](../captures/18ae50165696437db877aad2db450989.json) |
| Operation `25`, `ALIVE`, null address | `-1` | `22` (`EINVAL`) | [ALIVE comparison](../captures/18ae50165696437db877aad2db450989.json) |
| Operation `25`, `ALIVE`, owned mapped address | `-1` | `22` (`EINVAL`) | [ALIVE comparison](../captures/18ae50165696437db877aad2db450989.json) |
| Operation `25`, `LOOKUP`, null and owned mapped address | `-1` for both | `22` (`EINVAL`) for both | [LOOKUP comparison](../captures/11fd2460c36541f5a7a3b6772a95890a.json) |
| Ordinary operation `16` (`WAKE_PRIVATE`) on owned address, no waiters | `0` | Not read | [working-wrapper control](../captures/f0f0dab7bb9a451c97240692d983151e.json) |
| Operation `25`, `ALIVE`, verified live RX mapping in fourth argument | `-1` | `22` (`EINVAL`) | [mapping comparison](../captures/110e7a6079ce4ca48bd57d8a788e96ef.json) |
| Operation `25`, `ALIVE`, owned mapping in first argument, fourth argument, or both | `-1` in all three cases | `22` (`EINVAL`) in all three cases | [argument-slot comparison](../captures/77daa94df5c94fdaa6f9df7e3cca620b.json) |

The [modern upstream implementation](https://raw.githubusercontent.com/freebsd/freebsd-src/main/sys/kern/kern_umtx.c) handles `ALIVE` by checking a mapping and `LOOKUP` by finding a registered object. If Sony had that exact behavior, the null and mapped inputs should not all look like an invalid operation. **Inference:** the observed 14.00 path either lacks operation `25` or rejects these flags/addresses before the upstream shared-memory branch. Because Sony kernel code is unavailable, `EINVAL` alone cannot distinguish those possibilities. The ordinary wake control shows that the number-454 wrapper itself works. No registration was created, no destroy or race was attempted, and no shared-memory effect was observed. The UMTX shared-memory advisory does not currently pass the 14.00 reachability gate.

The tested 14.00 argument-slot capture above used owned mappings in the
first and fourth argument positions and received `EINVAL` for operation
`25` in both cases. This does not establish the full Sony implementation.

## Live mutex owner writeback on PS4 14.00

[FreeBSD 9's operation header](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/umtx.h) assigns `4` to nonblocking mutex try-lock, `5` to mutex lock, and `6` to unlock. Its [mutex structure](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/_umtx.h) puts a 32-bit owner at offset zero, and its [kernel implementation](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/kern/kern_umtx.c) writes the current thread ID on uncontested acquisition. These sources define a comparison, not Sony 14.00 implementation identity.

On the already byte-checked number-454 caller, a zeroed, aligned, owned 32-byte mutex gave the same result twice:

| PS4 14.00 operation | Return | Owner after call | Cleanup | Capture |
| --- | --- | --- | --- | --- |
| `4` try-lock | `0` | `101902` | `6` unlock returned `0`; owner became `0` | [try-lock and release](../captures/6e3991481a9b4bd299e897215fe1301b.json) |
| `5` lock | `0` | `101902` | `6` unlock returned `0`; owner became `0` | [lock and release](../captures/a44aff7fd907444995336b1022f1148a.json) |

Both captures passed the before/after PID, buffer guard, byte restoration, and JS caller restoration checks while the page continued polling. The equal nonzero owner words across the two calls are consistent with a thread ID, but an independent `thr_self` readback was not taken, so its exact identity remains an inference. This confirms ordinary `_umtx_op` mutex behavior on **PS4 14.00**. It does not imply shared-memory operation `25` is available, reveal a kernel pointer, or cross the browser sandbox.
