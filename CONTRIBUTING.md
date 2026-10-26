# Contributing

Contributions should make a PS4 14.00 claim easier to test or audit. Read [evidence rules](docs/EVIDENCE_RULES.md), [current progress](docs/PROGRESS.md), and [research gates](docs/RESEARCH_GATES.md) before proposing a new finding.

## Useful contributions

- Recheck a documented conclusion against its controls and raw capture ID.
- Add a bounded probe that distinguishes two concrete explanations.
- Improve the collector, capture verification, or offline tests.
- Correct a syscall name, source attribution, date, or unsupported claim with the evidence that supports the correction.
- Summarize a closed path so it is not repeated as an untested candidate.

## Probe and evidence workflow

1. Give each probe a unique versioned name in `probes/`, with a matching JSON manifest. Record the question, expected normal control, and what each outcome would mean.
2. Review the JavaScript before queueing it. It runs in the page's origin; a timeout cannot stop a synchronous loop or recover from a browser crash.
3. Confirm the console firmware in System Information. Treat the page's firmware label and user agent as reported fields, not proof of binary identity.
4. Run one diagnostic at a time through the local CLI. Preserve the source and manifest digests, command ID, markers, capture ID, and any console observation.
5. Write the result in `docs/` with direct observations separate from source-based explanations. Note negative controls, alternative explanations, cleanup, and any earlier claim superseded by the new result.
6. Keep raw captures, command state, and private network data in a local evidence archive. Do not add them to a pull request by default.

For a local session, use `python -m fw14lab.control sessions`, then `python -m fw14lab.control enqueue-probe --session SESSION_ID --manifest probes/NAME.json`. [The README](README.md) covers server setup. [Archive instructions](evidence/README.md) cover preservation and verification.

## Offline checks

Run from the repository root:

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

The tests check local behavior and fixtures. They do not establish a result on PS4 hardware. In a contribution, state which checks ran and whether a console test was performed.

## Pull request notes

Describe the claim or tool change, cite the relevant probe and document, and list what would falsify your conclusion. Do not replace a correction with an older headline or import offsets, gadgets, or call semantics from another firmware as PS4 14.00 facts. This repo requires PS4 14.00 evidence to answer its research questions.
