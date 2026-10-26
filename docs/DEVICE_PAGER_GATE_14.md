# Device-pager reachability on retail PS4 14.00

The [FreeBSD-SA-26:37.vm advisory](https://www.freebsd.org/security/advisories/FreeBSD-SA-26:37.vm.asc)
requires an unprivileged process to map a device that supplies unmanaged
pager pages, invalidate them with `msync`, and fault the mapping again.
This advisory is an upstream hypothesis, not proof that Sony 14.00 has
the same bug. The browser's earlier 14.00 filesystem check could open
`/dev/dmem0`, but a one-byte read returned `ENODEV`.

On the current 14.00 page, the [v31 native caller](../captures/1a761731d56a471d9f37ec424b880a2a.json)
byte-checked wrappers 65, 73, 477, and 482, and passed four process-ID
calls with restoration. The [pinned mapping check](../captures/d06641649cc1448981810c0725b9024a.json)
then mapped 16 KiB of anonymous read-only memory at a returned user
address and unmapped it with return zero. The same current-process
number-477 wrapper attempted a read-only shared map of 16 KiB at
offset zero from a freshly opened `/dev/dmem0` descriptor. It returned
`-1` with immediate errno `1` (`EPERM`); the descriptor closed with
return zero and the browser PID stayed the same. The probe did not
dereference or invalidate a device mapping.

This establishes a permission boundary for this mapping shape. It does
not prove that every device node is unmappable, that Sony implements
the upstream unmanaged pager, or that `msync` behaves like FreeBSD's.
The tested `/dev/dmem0` mapping shape did not satisfy the advisory
prerequisite, so no invalidate/fault test is warranted on that shape.

A second 14.00 page tested the separate browser-visible `/dev/dce` node,
which the captured VideoOut client opens read/write. A matched 16 KiB
anonymous read-only mapping and unmap returned successfully. The probe
then opened `/dev/dce` as fd 9 and attempted a read-only shared 16 KiB
mapping at offset zero. `mmap` returned `-1/EACCES (13)`; the descriptor
closed successfully, and no device mapping was accessed or invalidated.
[Verified DCE capture](../captures/6cac61f9f28c422c80dc7929aead0f89.json),
SHA-256 `3b5ffe53b9b99401210f51fcc02c63b4b292024de0bd077196b859b9f906bf3d`.
The two tested device paths therefore fail the advisory's mapping
prerequisite in these exact shapes. This does not establish whether a
different device, offset, mapping mode, or Sony pager implementation
would behave differently.
