# Full readable WebProcess mapping capture on PS4 14.00

The follow-on [reverse analysis](FULL_WEBPROCESS_REVERSE_14.md) verifies and
classifies every mapping, resolves the main executable's 66 imports, and
traces its `FMEMSizeLimit` startup path to fixed wrappers 194/195.

Captured 2026-10-24 from browser PID **68**, page session
`cae1c2f0636c4430ab13130bf6e1d974`. The two authenticated VM-map
captures are [`67c7fc5e`](../captures/67c7fc5e036741888972b388864d9373.json)
and [`52c88722`](../captures/52c88722f22e4a0c80dc10fa8fcb2813.json).
They describe **142** mappings totaling **301,875,200 bytes**. Thirteen
have no read permission, totaling **134,332,416 bytes**.

Of the **167,542,784 bytes** in 129 read-permitted mappings, the
[assembled manifest](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/manifest.json)
records **167,526,400 bytes in 128 complete mappings**, each with exact
size and SHA-256. This is **99.990221%** of the read-permitted span. The
remaining **16,384-byte RW mapping** is explicitly marked as skipped.
The [portable archive](../evidence/2026-10-24-ps4-14.00-webprocess-readable.zip)
contains the assembled mapping files, manifests, 271 run captures, both
VM-map captures, and pinned probe sources. Its ZIP CRC test passed;
SHA-256 is `ce508f31ef8b4a2e0e314e805a0c860b55325ca5e04474dae5774344c7312585`.
The browser warning occurred at its first 8 KiB on two independent pages:
commands `162e259ac80c487b9efd702206726a51` and
`da85142427254ca8b8549a48196b7aa5` did not return captures. After the
complete third-page run, command `2e0bb6c3a84f4544858bbbe6a324dc23`
recorded `faulted_map_first_byte_before`, then a **one-byte** read at the
corresponding mapping stopped the page. The operator observed the memory
warning and refresh. Its bytes are not claimed as captured.

The next browser process, PID **69**, showed a **48 KiB** RW mapping after
the same read-only group rather than the earlier 16 KiB shape. Its first
byte read returned `56` and restored state
([capture](../captures/fb6ef1b14ec545b5bc7c07c9c1ea9254.json)). A new
all-mapping run on that page then stopped at a **different**, earlier 16 KiB
RW mapping (command `a981e01bdcbe471ab2d640a060d0f074`, before marker,
no result capture). The operator confirmed a memory warning and refresh.
The [separate partial manifest](../evidence/live/full_process/9bf8554cd38742b3b1e7512edaff9ed6/manifest.json)
preserves its 1,671,168 complete bytes. These different page layouts and
failures prevent combining bytes from the two processes into a claimed
single complete snapshot. The missing 16 KiB on PID 68 is a measured
capture gap, not a claim that all mappings of that shape are permanently
unreadable.

The first upload was a two-chunk canary
([capture](../captures/5671dd8f9c704520b1afd994ef16f461.json)). The
remaining 271 authenticated commands used 8 KiB chunks, restored the
temporary typed-array pointer after every read, and stopped at mapping
boundaries. The [last capture](../captures/15701d3dcad44ff58cb97105460541aa.json)
reports target 128/128 complete. The exact command and capture IDs are in
[`full_process_run_cae1..._v2.jsonl`](../evidence/live/full_process_run_cae1c2f0636c4430ab13130bf6e1d974_v2.jsonl).
This is a sequential capture: writable pages may change between chunks.

All **28 executable mappings** were captured completely. SHA-256 and size
match all **26 RX images** in the prior [complete SPRX archive](FULL_SPRX_DUMP_14.md).
The two other RX mappings are the main executable's 32 KiB mapped segment
and a 16 KiB executable page with two identical fixed-number `417` syscall
instructions followed by `hlt`; it does not contain a variable-number
syscall gateway. The [full RX byte scan](../evidence/live/full_process/cae1c2f0636c4430ab13130bf6e1d974/syscall_sites.json)
found the same **298 unique fixed numbers in 302 canonical byte-pattern
sites** as the archived `libkernel_web` RX image, with no new number. The 30 numbers listed as
`sys_missing` by the page-local native installer are absent from this exact
fixed-wrapper pattern across the complete executable snapshot. That means
**no mapped browser fixed-number wrapper was found for them**. It does not
establish whether the kernel implements or authorizes those syscall numbers.

This capture covers the browser's readable virtual mappings. It does not
include kernel memory, other processes, read-protected or reserved mappings,
or bytes in the faulting 16 KiB mapping. It is not a full firmware image or
a sandbox escape. The browser-visible `/dev/dmem0` allowed open but returned
`ENODEV` on a one-byte read and `EPERM` on read-only `mmap`, as documented in
[the device-pager gate](DEVICE_PAGER_GATE_14.md).
