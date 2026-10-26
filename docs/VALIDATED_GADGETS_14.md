# 14.00-validated historical gadget locations

The old observer's gadget RVAs originated in a 13.00 table, but the retail console reporting firmware 14.00 read the instruction bytes at those locations twice and matched all 15 expected gadget fingerprints. The six pivot and six call-support checks in `muoxvgv8-a9ote9ig` were repeated before a native call returned; the three argument-register checks had been recorded in the earlier 14.00 base fingerprint. The call returned `87` in that run, `87` after a page reload, and `63` after a console reboot, with the browser function slot, pivot cell, and carrier restored. Later 14.00 records show bounded native calls with arguments and copyout into an owned buffer. This supports reusing **the validated code locations as candidates**, including the executed pivot path. It does not make the old object layout, carrier, imported symbol identities, or an absolute address from a previous browser process reusable.

Historical evidence: `../../old-webkit-project/ps4-research-captures/muoxvgv8-a9ote9ig.jsonl`, `muoxx762-c6lwxajs.jsonl`, and `muoyheng-0ofhi47h.jsonl`; the read-only audit is `../../old-webkit-project/KERNEL_PATH_AUDIT.md`. The current source file and exact page bytes served during those runs were not attested. The console firmware was independently confirmed as 14.00 during the new project's runs.

The 15 checked WebKit-relative locations were:

| Gate | RVAs |
| --- | --- |
| Pivot sequence, executed in the native-call path | G0 `0x295f948`, G1 `0x1d989e3`, G2 `0x25bae0`, G3 `0x4a0406`, G4 `0x1ec3ada`, G5 `0x2abccaa` |
| Call support, with `POP_RDI`, `POP_RAX`, `STORE_RAX`, and `LEAVE` in the observed call path | `POP_RCX 0x1bade`, `POP_RAX 0x10504`, `POP_R8 0x9b311`, `POP_R9 0x1dcfb1`, `LEAVE 0x182f7`, `STORE_RAX 0x548b` |
| Earlier base fingerprints; `POP_RDI` was used in the observed call path | `POP_RDI 0x5c480`, `POP_RSI 0x6e45e`, `POP_RDX 0x12c5ba` |

These are RVAs, not fixed process addresses. The old source and capture fields label their origin `13.00`; their eligibility here comes from the 14.00 instruction-byte matches and observed execution, with a fresh byte check required for each new use.

The new project has now passed these three gates:

1. Obtain a current-process WebKit base and an address-directed browser read using the independent History primitive. The typed-array data-pointer swap read below the original forged view and found a live function-code anchor. [Current-process read evidence](HISTORY_NATIVE_READ_14.md).
2. Re-read the exact bytes at each candidate `base + RVA` in the current browser process. All 15 matched twice in the first session, and the fresh-page call plan matched all 15 again with a different base. Current-process import targets and the number-20 wrapper also matched. [Code-byte captures](HISTORY_NATIVE_READ_14.md).
3. Build a new reversible native-call preflight around current-process object and buffer addresses. Owned buffers, pointer and byte gates, an initially zeroed result frame, restoration, and a fresh-page repeat all passed. [Two native-call captures](HISTORY_NATIVE_CALL_14.md).

The two page sessions used different WebKit bases (`0x83ebec000` and `0x80b2b4000`) and freshly derived their own heap addresses. This validates these specific bytes and the reversible call path on the observed 14.00 browser; it does not identify the exact shipped WebKit binary or imply sandbox or kernel access.
