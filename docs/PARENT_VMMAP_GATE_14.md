# Parent-process VM-map boundary on PS4 14.00

The browser's native caller measured its own PID `71` and its parent PID `38` on the same live page. A size-only `sysctl` query of the browser's own VM map (`{1,14,32,71}`) returned `0` and `22,592` bytes, matching the earlier full self-map read. The same size-only query for the dynamically measured parent (`{1,14,32,38}`) returned `-1/EPERM` and no size. No parent mapping data was requested after that denial. The owned frame, MIB words, output guards, and browser carrier were restored. [Verified capture](../captures/1bb83fa11d8b4566a5de8bdd4060ee3d.json).

This distinguishes the self-map success from the parent denial without hardcoding the parent PID across page refreshes. It closes this `KERN_PROC_VMMAP` size-query shape as a cross-process information path from the tested WebProcess; it does not establish that every process-information interface has identical policy.
