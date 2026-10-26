# Firmware 14.00 write-side fd close/reuse stress

2026-10-25, live PS4 14.00 browser session `8c0e9539dd244641a99b86aea7a196f3`.

The worker attempted native `kevent` `EV_ADD` on an owned Unix socket read fd after a page-triggered wake. In parallel, the page used one native call chain to trigger the wake, close that fd, and open a replacement socketpair that reused the same numeric fd. Each attempt wrote to both the retained old socket and the replacement socket, then read queue events to distinguish their sources. The worker's immediate syscall return and errno, fd reuse, event guards, pointer restoration, and descriptor cleanup were checked. Every completed attempt reported exact fd reuse and cleanup.

Three page-side timing variants were exercised. The numbers below count only complete, captured attempts; `replacement event` means the worker registered the reused fd and the replacement source signaled, whereas `old event` is the candidate stale-note oracle.

| Wake-to-close chain | Complete attempts | EBADF / no event | Replacement event | Old event | Page chain before worker return |
| --- | ---: | ---: | ---: | ---: | ---: |
| `kevent`, two `getpid`, close, reopen | 576 | 421 | 155 | 0 | 84 |
| `kevent`, one `getpid`, close, reopen | 576 | 392 | 184 | 0 | 46 |
| `kevent`, close, reopen | 512 | 328 | 184 | 0 | 92 |
| **Total** | **1,664** | **1,141** | **523** | **0** | **222** |

The normal alternatives changed frequency across schedules, so registration and descriptor reuse genuinely raced. No completed attempt showed an old-source event or an unexpected return. This does not establish whether Sony retained the upstream FreeBSD fd-mapping guard: the internal `fget()` to queue-lock interval cannot be observed or held by this harness. A kernel primitive and exploit chain remain unproved.

The first two-delay burst [capture](../captures/a0cda5f12f8d4dadbbf81f9b35322a11.json) stopped at the collector's eight-marker limit; it is excluded. Removing repeated per-attempt markers yielded complete captures for [two-delay](../captures/4527b466401c4df48c96bd35edd32367.json), [one-delay](../captures/fcb5aaebd5f74868a6f53900afeb3016.json), and [direct](../captures/0937299deec04cf7a26b02735ef62e81.json) batches. All 27 stored burst captures passed `fw14lab.verify`; 26 contained complete 64-attempt results.

The eighth direct-timing batch, command `d2df133fa97f404594fbb19292b0d03f`, was claimed at `2026-10-25T08:00:37Z`. Its only acknowledged marker was `fd_burst_start` at `08:00:38Z`; no capture or later browser poll arrived. The local server remained listening and the console IP answered ICMP. The user confirmed the console remained responsive and reloaded the research page into new session 7fb73a26790344ee9f3e08deef70e32e, WebProcess PID 64. This stall is not counted as a race outcome or a kernel crash.

Sources: [burst builder](../tools/build_fd_reuse_burst.py), [sequential runner](../tools/run_fd_reuse_bursts.py), [two-delay manifest](../probes/clone_history_worker_fd_reuse_burst_v1.json), [one-delay manifest](../probes/clone_history_worker_fd_reuse_burst_delay1_v1.json), [direct manifest](../probes/clone_history_worker_fd_reuse_burst_direct_v1.json). The runner stops when a completed batch reports an anomaly and retains its capture.
