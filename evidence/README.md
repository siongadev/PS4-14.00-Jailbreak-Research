# Evidence and local archives

The [full mapped-SPRX capture](live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json) is included: 78 RX/RO/RW segment files from 26 browser-loaded modules, plus the metadata and analysis outputs cited by the research notes. The manifest records each segment's size and SHA-256. These are captured process-memory images, not signed SPRX files.

Run `python tools/verify_sprx_dump.py` from the repository root to check every included segment against that manifest.

Raw observation captures, probe snapshots, live upload chunks, Ghidra project databases, and the SQLite command queue stay local. ZIP evidence archives are not bundled with this source repository. Notes citing those records still require the corresponding archive for independent inspection.

With a populated local workspace, create and verify a snapshot from the repository root:

```powershell
python tools/archive_evidence.py evidence/ps4-14.00-snapshot.zip
python tools/verify_evidence_archive.py evidence/ps4-14.00-snapshot.zip
```

The archive helper includes a SQLite backup and SHA-256 manifest. Review archive contents before sharing; they may contain console-session or LAN information. The archive can be large and is ignored by Git.
