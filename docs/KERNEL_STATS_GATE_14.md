# Kernel-memory statistics gate on PS4 14.00

The public [PS4 syscall table](https://www.psdevwiki.com/ps4/Syscalls)
names number 646 `get_kernel_mem_statistics`; that historical name is
only a call-shape lead. The 14.00 native caller had already byte-checked
its current-process wrapper. A single guarded probe supplied an owned
256-byte output pointer and size 256, then rechecked the browser PID.

The call returned `-1` with errno `1` (`EPERM`). It changed zero output
bytes, left the following 256-byte guard intact, and preserved PID `72`
and the native caller state. [Verified capture](../captures/5ff67ddd77f14b1b91b424e43fb5698f.json),
[pinned probe](../probes/clone_history_kernel_mem_stats_gate_v1.js).
This call shape exposes no kernel statistics from the browser. Its
argument contract is not proven, but the clean permission denial makes
blind pointer or size variations low value until a 14.00 ABI source or
a different authority state is measured.
