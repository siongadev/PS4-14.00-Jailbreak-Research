# 14.00 SlimGL client launch path

The completed browser-process [SPRX dump](FULL_SPRX_DUMP_14.md) includes
`libSceGLSlimClientVSH.sprx` (handle 83). Its verified RX, RO, and RW
mappings were wrapped in an [analysis-only ELF](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/slimgl.elf),
which is not an original Sony binary. The
[focused decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/slimgl_functions.txt)
shows a Unix-domain client for `SceWebCore/SceSlimGLServerProcess`.
It retries while that server starts and reads an eight-byte notification
after connection.

At RX+`0x2370`, the startup function accepts an optional render-server
path. With no path, it chooses `/app0/SlimGLRenderServer_vsh.self` or
`/hostapp/SlimGLRenderServer_vsh.self` after path checks. With a path,
the [deeper client function](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/slimgl_launch_path.txt)
creates a socketpair and forwards the selected string to its
`libSceSystemService` import at RX+`0x3c8`. The live import-link report
resolves that target to SystemService RX+`0x4950`, whose embedded
function name is `sceSystemServiceAddLocalProcess`.

The SystemService [request builder](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/system_service_addlocal_dispatch.txt)
checks a non-null path and parameter block, requires an initialized
client, and bounds combined argument strings to 4 KiB. It then sends
an LNC `addLocalProcess` request. Those observed client checks do not
contain a local path allowlist; authorization in the privileged server
is outside the captured browser process.

This route converges on the previously tested
[SystemService launch gate](SYSTEM_SERVICE_IMAGE_14.md). On this same
firmware, a fully formed launch of an existing `webapp.self` and a
read-only process-list request both returned `0x8094000F`, publicly
named `NOT_ALLOWED`. We did **not** repeat a launch merely with a new
path. A fresh-page read-only `sceSystemServiceGetAppStatus` call on PID
74 returned zero with words `0x60000201`, `0x60000100`, and `1`, restoring
its owned buffer and native state
([capture](../captures/83f854063ca1499fbeaa37e5276070ea.json)).
The earlier status run had a different first word, but no evidence yet
ties that difference to authorization. The byte-checked current-page
installer is [capture `c4f5f181`](../captures/c4f5f1810ff9423db361771278612d3c.json).

This establishes a concrete browser-side launch request route and its
existing denial. It does not establish that a caller-supplied path
would launch an arbitrary executable, bypass signing, or cross the
sandbox. The server-side policy remains unobserved.
