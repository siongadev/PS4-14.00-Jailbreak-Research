# Number-624 return sequence on retail PS4 14.00

The historical PS4 syscall list calls number 624
[`get_vm_map_timestamp`](https://www.psdevwiki.com/ps4/Syscalls).
That is an ABI hypothesis for the current firmware. The initial
brute-force capture showed changing positive returns for several first
arguments and described them as newly allocated IDs. A changing number
alone cannot distinguish IDs from a timestamp or generation counter.

On current session `6780d62a1b2e41f7a4758525a146c534`, PID `71`,
the byte-checked number-624 wrapper returned `40036`, `40037`, `40038`,
`40040`, and `40043` for rapid arguments `0, 0, 4, 0xffffffff, 0`.
After creating and touching an owned 1 MiB `ArrayBuffer`, the same
sequence returned `40049`, `40049`, `40051`, `40053`, and `40053`.
All high return words and immediate error values were zero; the buffer
and PID controls held. [Verified capture and pinned source](../captures/744d291854d94d029eab9ecd169b62cd.json).

The values are nondecreasing across argument changes and can repeat on
adjacent calls. This is consistent with a VM-map timestamp affected by
other page/runtime activity. The 1 MiB allocation does not isolate the
cause of the intervening increase, because WebKit also allocates while
running the probe. There is no evidence these values identify newly
allocated objects, and they must not be supplied as handles to other
syscalls on that premise. The exact scope and update rules of the
counter remain unmeasured.
