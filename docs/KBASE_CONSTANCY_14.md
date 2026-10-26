# Correction: syscall 638 is a time conversion, not a kernel-base disclosure

Status: the former kernel-base interpretation is **withdrawn** (2026-10-22).
The captures remain authentic PS4 14.00 observations; their arithmetic was
misidentified. This record replaces the old “KBASE constancy” claim.

The [public PS4 syscall table](https://github.com/a0zhar/PS4-SCE/blob/main/syscalls.md)
names number 638 `sys_utc_to_localtime`. The earlier probe
[`clone_history_syscall638_recheck_v1.js`](../probes/clone_history_syscall638_recheck_v1.js)
passed a numeric first argument and two writable output pointers. Its
[passing capture](../captures/c96e6f151afb44d08b128512750f1df5.json)
(SHA-256 `6566a842ac170fac8f4eefad7e0ecf55843a628d1667b84590b3b210203e78ab`)
reported these first-output values:

| input | output interpreted as signed 64-bit | output − input |
|---:|---:|---:|
| `0` | `0xffffffffffffaba0` = −21,600 | −21,600 seconds |
| `0x7fffffff` | `0x000000007fffab9f` | −21,600 seconds |
| `0xffffffff` | `0x00000000ffffab9f` | −21,600 seconds |

**21,600 seconds is six hours.** The exact relation for all three
inputs and the historical function name strongly identify the first
output as a timezone-adjusted timestamp. Repeated values across boots
are expected for a stable timezone setting; they are not evidence of a
fixed kernel address. The extra 12-byte output was not decoded under
the time-conversion ABI, so its pointer-shaped words have no established
kernel-memory meaning either.

The former “candidate base” `0xffffffffc4e50000` was obtained by
subtracting a chosen constant `0x3b1aaba0` from the zero-input
conversion result. That arithmetic alone cannot identify a kernel
image. The old P1/P2 kernel-base, mapping-oracle, and constancy claims
are superseded. The remaining firmware-14.00 browser-process
read/write and native-call findings are independent of this correction.
