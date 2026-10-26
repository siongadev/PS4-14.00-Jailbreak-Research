# Evidence rules

Each claim must say what was directly observed, on which device and firmware, by which method, and where the raw record lives. Use these labels:

| Label | Meaning |
| --- | --- |
| `observed-14.00` | A result captured on a console whose 14.00 version was independently checked and recorded |
| `sony-source-label` | A Sony source archive or page with its exact published version label |
| `upstream-analogy` | An upstream project explains a possibility but does not establish Sony's implementation |
| `unknown` | Identity, behavior, or provenance has not been verified |

For every technical claim, record:

1. Exact claim, inputs, expected control, and observed output.
2. Device and firmware verification method, including any operator-supplied fields.
3. Raw capture ID, SHA-256, source URL or artifact hash, and date.
4. Alternative explanations and what measurement would distinguish them.
5. Label from the table above. Promote a claim only when new evidence supports it.

The collector's `firmware_label` is operator supplied. Its `user_agent` and check results are browser supplied. The server adds `received_at`, a unique `capture_id`, and a SHA-256 of the submitted JSON serialized with sorted keys, compact separators, and UTF-8. These fields show what reached the PC; they do not verify the console's firmware, browser binary, or kernel state. Capture files are written once under `captures/` and are never served over HTTP.

Version-2 command captures also record the browser session and command IDs, named action, attempt number, browser execution times, and the SHA-256 of the page assets the server served. A session ID is an identifier, not an authenticator; its separate secret authorizes polling and result delivery on the local server. The asset hash supports reproducibility of the served page, but does not attest that the console executed those bytes or establish a match with a Sony source release. A result submitted after a network retry must retain the same command and attempt identity.

Version-3 captures for local probes additionally record the probe ID, expected check IDs, timeout, runner version, manifest digest, and source digest. The server snapshots probe source before queueing, and the page checks its fetched source digest before execution. These hashes identify PC-held bytes and detect accidental changes. They do not make arbitrary probe JavaScript safe, attest execution on the PS4, or prove which Sony browser build is running. A probe error or missing result is evidence of that test's outcome only; a browser crash requires separate confirmation.

## Source limits for 14.00

- Sony's [PS4 system software page](https://www.playstation.com/en-us/support/hardware/ps4/system-software-info/) lists 14.00, but does not identify its WebKit or kernel revision.
- Sony's [PS4 WebKit source page](https://www.playstation.com/en-us/oss/ps4/webkit/) labels its latest archives `13.00 -`. That label alone does not identify the exact 14.00 browser binary. Sony's [JavaScriptCore page](https://www.playstation.com/en-us/oss/ps4/webkit-javascriptcore/) has a broader `7.00 -` label.
- Sony's [FreeBSD Kernel OSS page](https://www.playstation.com/en-us/oss/ps4/freebsd-kernel/) gives notices, without a 14.00 kernel revision or syscall table.
- [WebKit documents](https://docs.webkit.org/Ports/Introduction.html) that ports release independently. An upstream WebKit commit or version cannot itself fingerprint the PlayStation build.

Offsets, symbol names, syscall meanings, object layouts, and error contracts from another firmware or upstream tree start as `unknown` or `upstream-analogy`. A matching syscall wrapper confirms encoded number and bytes at one address. It does not, by itself, identify Sony's handler or its security properties.
