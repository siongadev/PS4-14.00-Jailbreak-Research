# Research priorities

Status source: [2026-10-24 progress report](docs/PROGRESS.md). These are evidence tasks, not an assertion that any candidate is exploitable.

1. **Find a distinct sandbox-boundary hypothesis.** Use the measured browser module and client maps to choose a PS4-specific server method or kernel transition with independent before/after readback. The exact route-table mutation and VideoCore stream lifecycle tested on October 24 are closed for this phase. See [next sandbox run](docs/NEXT_SANDBOX_RUN_14.md).
2. **Keep kernel claims gated.** Establish a firmware-specific entry and an outcome that distinguishes a memory-safety effect from ordinary syscall behavior. The current AIO, UMTX, device, and service observations do not demonstrate kernel read/write. See [research gates](docs/RESEARCH_GATES.md).
3. **Preserve reproducibility.** Archive raw captures, the SQLite queue, and exact probe snapshots for each meaningful run. Verify archive digests before sharing a claim. See [evidence rules](docs/EVIDENCE_RULES.md) and [archive instructions](evidence/README.md).
4. **Review documentation against the latest controls.** Keep the [progress report](docs/PROGRESS.md), [research chain](RESEARCH_CHAIN_14_00.md), and [documentation index](docs/INDEX.md) in sync when a result is corrected or a gate closes.

Before running a historical probe, check its associated note for warnings and superseding controls. Some recorded probes intentionally caused a memory warning or a blocked wait and are evidence artifacts, not routine diagnostics.
