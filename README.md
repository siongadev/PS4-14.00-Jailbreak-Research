# PS4 firmware 14.00 research

This repository contains the PS4 14.00 browser research workspace: a local capture server, versioned JavaScript probes, offline tests, and the notes that connect observations to their limits. It is organized around the PS4 browser entry point and the evidence collected from a retail console reporting firmware 14.00.

## Current status

The latest consolidated device record is dated **2026-10-24**. The detailed evidence and corrections are in [the progress report](docs/PROGRESS.md).

| Milestone | Status on PS4 14.00 | Evidence |
| --- | --- | --- |
| Browser-process memory read/write | Demonstrated with fresh-page repeats | [History address-directed read/write](docs/HISTORY_ADDRESS_DIRECTED_RW_14.md) |
| WebKit-process native execution | Demonstrated through code reuse on two page sessions | [Native-call record](docs/HISTORY_NATIVE_CALL_14.md) |
| Browser process and interface map | All 26 loaded SPRX modules mapped; selected clients tested | [Module inventory](docs/ALL_LOADED_MODULES_14.md), [progress report](docs/PROGRESS.md) |
| Browser sandbox escape | **Not demonstrated** | [Sandbox boundary](docs/SANDBOX_BOUNDARY_14.md) |
| Kernel memory read/write or kernel execution | **Not demonstrated** | [Research gates](docs/RESEARCH_GATES.md) |
| Complete jailbreak | **Not demonstrated** | [Research chain](RESEARCH_CHAIN_14_00.md) |

The browser result is a measured userland result. A successful native call, IPC connection, or syscall return alone does not prove a sandbox escape or kernel exploit. The older syscall-638 “kernel base” interpretation was withdrawn after a time-conversion match; [the correction](docs/KBASE_CONSTANCY_14.md) is part of the record.

## Repository map

| Path | Contents |
| --- | --- |
| [`web/`](web/) | Browser page and bounded runner |
| [`assets/`](assets/) | Small, non-sensitive media fixture required by the local VideoCore oracle |
| [`fw14lab/`](fw14lab/) | Python standard-library server, command queue, and capture verification |
| [`probes/`](probes/) | Versioned JavaScript probe source with JSON manifests |
| [`docs/`](docs/) | Findings, negative results, corrections, and research gates |
| [`tools/`](tools/) | Analysis and evidence-archive helpers |
| [`tests/`](tests/) | Hardware-free Python and Node tests |
| [`references/`](references/) | Public-source provenance and hashes; extracted source remains local |
| [`captures/`](captures/) and [`control/`](control/) | Local run records and SQLite command state; raw data is ignored by Git |
| [`evidence/`](evidence/) | Included [mapped SPRX dumps](docs/FULL_SPRX_DUMP_14.md) plus local archives that remain ignored by Git |

See [the detailed workspace guide](WORKSPACE_GUIDE.md), [documentation index](docs/INDEX.md), [research priorities](TODO.md), and [contribution guide](CONTRIBUTING.md). The layout keeps the PS4 browser workflow, evidence, probes, tools, and tests easy to navigate.

## Run the local collector

Use Python 3.11 or newer. From the repository root:

```powershell
python -m fw14lab.server
```

Open `http://127.0.0.1:8765/` on the PC. For a PS4 on the same trusted local network, bind the PC's LAN interface:

```powershell
python -m fw14lab.server --host 0.0.0.0 --port 8765
```

Then open `http://PC-LAN-IP:8765/` in the PS4 browser. Verify the firmware in **Settings → System → System Information**. The page's `14.00` label is operator supplied; neither that label nor the user agent independently attests to the console's firmware.

The page registers a session with the local server. On the PC, inspect it and queue a bounded built-in check:

```powershell
python -m fw14lab.control sessions
python -m fw14lab.control actions
python -m fw14lab.control enqueue --session SESSION_ID --action runtime_inventory_v1
python -m fw14lab.control commands
```

To run a versioned local probe, review its JavaScript and manifest first, then queue it:

```powershell
python -m fw14lab.control enqueue-probe --session SESSION_ID --manifest probes/clone_graph_identity_v1.json
python -m fw14lab.control markers --command-id COMMAND_ID
```

The runner snapshots source and manifest digests before execution. Probe JavaScript runs in the browser page's origin and can be disruptive. A claimed command is not automatically retried. The HTTP API cannot upload or enqueue source; only a local CLI operator can do that. [The original workflow details](docs/EVIDENCE_RULES.md) explain what the hashes do and do not establish.

## Verify without a console

```powershell
python -m unittest discover -s tests -v
python tools/verify_sprx_dump.py
node --check web/app.js
node --check web/probes.js
foreach ($test in Get-ChildItem tests/test_*.js -File) {
    node $test.FullName
    if ($LASTEXITCODE -ne 0) { throw "$($test.Name) failed" }
}
```

The [offline CI workflow](.github/workflows/offline-verification.yml) runs these checks. Offline tests validate code and test fixtures; they cannot reproduce a PS4 observation.

## Evidence and publication

Each technical claim should identify the exact input, control, output, firmware check, capture ID or source hash, and alternatives. Use the labels in [evidence rules](docs/EVIDENCE_RULES.md). This repository includes the 78 mapped RX/RO/RW segments captured from 26 browser-loaded SPRX modules, their [SHA-256 manifest](evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/manifest.json), and documented analysis outputs. These are live memory images, not the signed SPRX files. Raw `captures/`, `control/` state, other live dump chunks, and ZIP archives remain local; notes citing those records still require the corresponding archive for independent inspection. [Archive instructions](evidence/README.md) describe local preservation and verification.

No license is assigned to this repository yet; select terms for this PS4 work before inviting reuse.
