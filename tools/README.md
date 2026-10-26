# Tools

The root [README](../README.md) covers the browser collector and command queue. This directory holds offline analysis helpers and evidence archival tools used by the research notes.

| Tool | Purpose |
| --- | --- |
| `archive_evidence.py` | Save captures, probe snapshots, live artifacts, and a SQLite backup in one ZIP with a SHA-256 manifest |
| `verify_evidence_archive.py` | Check ZIP CRCs, member hashes, and SQLite integrity |
| `verify_sprx_dump.py` | Check every included mapped-SPRX segment against its manifest size and SHA-256 |
| `remote_zip_member.py` | Extract named public-source members for local comparison; see [source provenance](../references/README.md) |
| `assemble_bulk_dump.py`, `assemble_full_process_dump.py` | Reassemble local browser-process capture chunks for offline analysis |
| `scan_all_module_syscalls.py`, `map_module_syscall_imports.py` | Analyze captured module images and callsite maps |
| `ghidra_scripts/` | Scripts for local reverse-engineering projects; Ghidra project databases are not included |

The mapped-SPRX inputs are included under `evidence/live/full_sprx/`. Other analysis helpers may require local inputs under `evidence/` or `analysis/` that remain ignored by Git. Review a script's arguments and the cited research note before using it. The standard-library collector and its test suite do not require these analysis inputs.
