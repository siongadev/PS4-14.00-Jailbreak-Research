# PS4 14.00 research chain: evidence gates

This is a status map, not a claim of a working jailbreak. The research route here begins in the PS4 browser.

| Stage | Required observation | Current status |
| --- | --- | --- |
| Environment | Console version checked independently; capture records the session | Console reported 14.00; running browser binary identity remains incomplete |
| Browser primitive | Repeated address-directed read/write with controls and restoration | Demonstrated; see [History read/write](docs/HISTORY_ADDRESS_DIRECTED_RW_14.md) |
| Browser native execution | Native effect beyond ordinary JavaScript, repeated on a fresh page | Demonstrated through mapped-code reuse; see [native call](docs/HISTORY_NATIVE_CALL_14.md) |
| Browser sandbox boundary | Independent protected-resource effect with a matched control | Not crossed; selected service calls and syscalls returned ordinary data or denials |
| Kernel primitive | Firmware-specific kernel memory or control effect | Not demonstrated |
| Full jailbreak | Repeatable chain through the required boundaries | Not demonstrated |

The browser's 26 loaded modules and selected client interfaces are mapped, but a mapped callsite or successful IPC handshake is an interface observation. It is not evidence that the service grants unauthorized authority. Read [the progress report](docs/PROGRESS.md) and [research gates](docs/RESEARCH_GATES.md) before promoting any candidate to a new stage.

Future tests should start with a PS4 14.00-specific hypothesis, a normal control, an independent effect oracle, exact probe and capture hashes, and cleanup. Closed call shapes and corrections are documented so a return code is not reinterpreted as a boundary crossing.
