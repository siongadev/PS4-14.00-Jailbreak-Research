# Full loaded-SPRX memory capture on PS4 14.00

The current browser can read mapped module bytes from its own process.
On the 2026-10-23 page session `2119cf8f1a734dc5a6b964e8c2b1d3fb`
(browser PID 74), all **26 loaded SPRX modules** were captured across
**78 mapped RX/RO/RW segments**, totaling **111,853,568 bytes**. Every
segment has exact, nonoverlapping coverage and a host-computed SHA-256 in
the [manifest](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json).
A loaded SPRX memory image differs from its
signed file: relocated pointers, resolved imports, writable state, file
headers not mapped into memory, and unmapped sections cannot be inferred
from the live bytes alone.

The repository now includes all 78 assembled segment files at the paths
listed in the manifest, along with cited JSON/text analysis and derived
ELF aids. Live upload chunks, ZIP archives, and Ghidra project databases
remain local. Every included segment was rechecked against its manifest
size and SHA-256 after copying; `python tools/verify_sprx_dump.py` repeats
that check on any clone.

The new bulk path has three page-local stages:

1. `clone_history_bulk_module_census_v2` uses live module-list and
   module-info-ex calls to measure names, handles, and current bases.
2. `clone_history_bulk_map_census_v3` matches those bases against the
   current process VM map and records executable, read-only, and writable
   mapping spans. Three info-ex bases point inside RW rather than at the
   RX start; v3 backtracks through contiguous RX/RO/RW entries to include
   those modules.
3. `clone_history_bulk_dump_v4` and `clone_history_bulk_dump_missing_v1`
   read only those measured spans, restore the forged data pointer after
   every 8 KiB read, and advance a page-local cursor. Each command stops
   at a segment boundary. The v1 two-chunk canary and v2 larger bounded
   transfer passed before the full run.

The upload route accepts only an active, authenticated, hash-pinned probe
claim. It limits raw chunks to 8 KiB, checks mapping metadata and range
bounds, hashes each byte sequence, and rejects conflicting retries.
Each chunk and its metadata are preserved under
`evidence/live/bulk_chunks/<session>/<command>/`. The host must verify
complete, nonoverlapping coverage and hash the reconstructed segments
before treating any module as fully dumped. The
[assembler](../tools/assemble_bulk_dump.py) verified all 78 segments.
The module census is [capture `e2a6e268`](../captures/e2a6e268d12b49f7a5a342fe1aba8ca5.json)
and the final map census is [capture `e5effb9b`](../captures/e5effb9b48364cf396f68bec4d6c6c9c.json).
The authenticated upload and idempotency tests pass locally.
The [evidence archive](../evidence/2026-10-23-full-sprx.zip) verified
all 30,660 manifest entries and its SQLite backup (archive SHA-256
`28fe5e222c3f5069f896ed4d1b6b3fdbfc183d2114c7d1615b119a7a14505caa`).

The [live import-link report](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/import_graph.json)
identifies 3,377 candidate RIP-relative import thunks across 105 module
edges, by resolving captured RO/RW pointer slots back into mapped RX
segments. This is a structural browser-process graph, not proof of a call
being executed or an interface being permitted. In particular,
`libSceSysCore` has three such links into `libSceIpmi`, while
`libSceSystemService` links into IPMI, Mbus, RegMgr, and SysCore.

These captures cover this browser process only. They do not contain the
privileged IPMI servers or kernel implementation, so no sandbox escape
or kernel primitive follows from dump completion. A page refresh requires
a new census and fresh addresses; the saved bytes remain evidence for
offline analysis.
