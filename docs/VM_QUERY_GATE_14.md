# Virtual-query contract gate on retail PS4 14.00

[CTurt's original PS4 browser research](https://cturt.github.io/ps4-2.html)
used syscall 572 as `(address, flags, output, 0x40)` to describe a mapped
region. That is historical ABI evidence, not proof that Sony 14.00 kept
the same contract. The current page's number-572 wrapper was located
and byte-checked by its native-caller setup before these calls.

On 14.00 session `6780d62a1b2e41f7a4758525a146c534`, PID `71`,
the first [read-only comparison](../captures/3d555273ff1c491eb48e70694ee2ad12.json)
queried an address inside the page's owned native frame, with flags `0`
and a guarded 64-byte output. It returned `-1/EINVAL` without changing
the output. A null-address control gave the same result. A first version
of this probe returned an array in its collector details, which the
runner rejected as an invalid report; that [capture](../captures/7b5e9d2dbf6f4aea956f57b377bc52bd.json)
is a reporting failure, not a query result.

The [size/flag comparison](../captures/06035886e34d40b6acd4fc5cf1ded4bb.json)
then tested output sizes `0x40`, `0x80`, `0x100`, and `0x200` for the
owned mapped address with flags `0`, plus `(address=0, flags=1)` at
sizes `0x40` and `0x100`. All six calls returned `-1/EINVAL` without
changing any output byte. The guard held and the browser PID remained
`71`. The page continued polling after both completed probes.

The historical call shape therefore has no useful 14.00 readback in
this setup. The cause could be a changed structure, policy, or a
different argument contract. This does not establish that syscall 572
is absent, that the mapped address is invalid, or that its kernel
handler matches the historical source. Further attempts need a 14.00
caller or structure discriminator, rather than more blind output sizes.
