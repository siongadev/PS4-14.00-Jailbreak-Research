# 14.00 LNC status-list client: matched service denial

This is a source-shaped device probe from the complete live
`libSceSystemService.sprx` image in session
`2119cf8f1a734dc5a6b964e8c2b1d3fb`. It is not evidence that the
browser can read another process's status or escape its sandbox.

The [14.00 request decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/lnc_request_range_2.txt)
shows RX+`0xd680` sending method `0x3002f` through the same `+0x58`
synchronous IPMI vtable entry whose raw packet was matched on live
VideoCore and LNC calls. Its first descriptor is a four-byte entry
capacity. Its two output descriptors are an array of `capacity * 0x42c`
bytes and a separate four-byte returned entry count. The
[named caller](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/lnc_client_callers_range.txt)
labels this `getAppStatusListForShellUIReboot` and bounds capacity at
16. These are browser-client facts; the server's authorization logic is
not mapped in this process.

The original [one-entry probe](../probes/clone_history_lnc_reboot_list_v1.js)
uses a freshly measured SystemService client and owned native frame. It
first calls the already-proven ordinary app-status wrapper as a
connection control, then sends one raw `0x3002f` request with capacity
1, a `0x42c`-byte list buffer, and a four-byte count buffer. It records
both return words, count, guards, native state restoration, and the
complete list buffer in five collector-compliant chunks if the method
succeeds. It never modifies or disconnects the module-owned client.
The [generator](../tools/make_lnc_reboot_list_v1.py) reproduces the
pinned source. JavaScript syntax and the six-check collector contract
passed local validation. Its first live run returned `-1/EINVAL` before
the service method result was written, as did the matching local-list
probe. Those [reboot](../captures/63606a1d7cc7418688b5625fca277e44.json)
and [local](../captures/97d60090a3b8405caa7d7ff46a2e5800.json)
captures establish a malformed raw packet, not a service denial. Their
`pass` check status reported only guard and restoration integrity.

The v2 input-pointer hypothesis was wrong: the 14.00 request builder
stores a data pointer and length together at `&local_28`. Its
[v2 capture](../captures/7363df9c287a4030ae61cb5b5275c7df.json)
again returned `-1/EINVAL`. Disassembly of the complete live
SystemService RX image at `RX+0xd680` resolves the actual mismatch:
the two output descriptors start at stack offsets `-0x50` and `-0x38`,
**24 bytes apart**, while v1 placed them 16 bytes apart. The
[v3 generator](../tools/make_lnc_status_lists_v3.py) preserves the
original input descriptor and uses that 24-byte output stride.

On fresh 14.00 page `5e498bf4a9264d1281e4e7e8fb72195f`, the
[v3 ShellUI-reboot list](../captures/a1ce036d532d459b8931aad8c7048c9d.json)
and [v3 local list](../captures/b964f3e5e9f949bb84706c191ae6778c.json)
both returned native syscall `0`, syscall-result `0`, and method-result
`0x8094000F`. Both returned zero entries. Their output buffers were
zeroed, their guards held, and scratch state was restored. This is a
matched service denial, with no status record to extract. The method
result agrees with the earlier official-wrapper local-list denial.

The alternate [GPU crash-status read](../captures/e0715ffe921f44648cf038d7c2856b46.json)
also returned native syscall `0` and method-result `0x8094000F`; its
`0x524`-byte buffer was zeroed. Its `pass` check status likewise means
the guard/restoration checks passed, not that the service granted the
read. No protected data was returned by any of these three methods.

The source-named `getAppFocusedAppStatus` method `0x30020` is a separate
zero-input, 12-byte output read. Its [same-page matched
capture](../captures/7f5bf6475c5e40d89cf32d8af30df1c6.json)
recorded current-app status `010200600001006001000000` through the
official wrapper, then returned native syscall `0` and method-result
`0x8094000F` for focused-app status, with a zeroed output. The guard,
restoration, and capture verification passed. This rules out that exact
focused-status read as an alternate data leak on this page.
If a later v3 capture returns a successful method result, run
`python tools/extract_lnc_reboot_list.py captures/CAPTURE_ID.json --method reboot_v3 --out evidence/live/lnc_reboot_list_14.00.bin`.
The [extractor](../tools/extract_lnc_reboot_list.py) verifies the pinned
source snapshot, capture receipt, all six checks, guards, exact output
length, checksum, and returned count before writing the bytes. A
synthetic full response passed, while altered data and a missing source
snapshot were rejected. This validates the tooling, not the device
method.

The ordinary `getLocalProcessStatusList2` path (`0x3000f`) also returned
`0x8094000F` with no entries through its official wrapper on an earlier
page. The fresh v3 local-list capture above is the same-page,
same-transport comparison. It uses a `0x24`-byte entry rather than the
ShellUI list's `0x42c`-byte entry and returns the same denial.

A result from `0x3002f`
would matter only if it identifies a process or data outside the browser
that the browser cannot obtain through its ordinary process and file
queries. A success code with zero entries, a browser-only record, or a
service error does not establish sandbox escape.

Further equivalent LNC status-list calls are not a useful next test
without a source-backed reason to expect a different authorization
context. The live client transport works; this branch has not crossed
the service permission boundary.
