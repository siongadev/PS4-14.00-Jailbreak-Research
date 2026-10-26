# Reentrant canvas context replacement on PS4 14.00

**Status:** Reproduced browser-visible context replacement on the operator's
Settings-confirmed PS4 14.00. This matches the pre-fix path of WebKit bug
[313175](https://bugs.webkit.org/show_bug.cgi?id=313175), published as
[CVE-2026-43720](https://webkitgtk.org/security/WSA-2026-0004.html).
WebKit's [fix](https://github.com/WebKit/WebKit/commit/040ef6e21ffac03b6d6098e0e12354bdb5469ad1)
identifies the resulting stale JS wrapper as a use-after-free when the wrapper
is swept by GC. Follow-up live probes found a reused 2D-context slot and a
cross-object canvas pixel write through the stale wrapper; see
[the native follow-up](CANVAS_NATIVE_FOLLOWUP.md).

## Why this is a distinct lead

The official [Sony PS4 WebKit source page](https://www.playstation.com/en-us/oss/ps4/webkit/)
labels the `WebKit-616-1300.zip` archive for **13.00 and later**. Its
`Source/WebCore/html/HTMLCanvasElement.cpp` checks `m_context` at the start of
`getContext` (local extracted member, lines 224-264). For a 2D context it then
converts a JavaScript options dictionary (lines 266-269) and calls
`createContext2d` (line 271) without checking `m_context` again. The create
method has only `ASSERT(!m_context)` before assigning a new context
(lines 345-357). Dictionary conversion calls a user-defined getter, which
can synchronously call `getContext` on the same canvas. The subsequent outer
assignment replaces the context created in the getter. This source is a
published analogue, **not** a measured copy of the console's browser binary.

WebKit's later fix adds the missing check after dictionary conversion and
describes destruction of the inner native context while its JS wrapper is
still alive. Its regression test exercises both same-type and cross-type
reentry, then GC. That is the mechanism tested here; the live console result
independently establishes the context replacement behavior.

## Console controls and results

All runs below used remote session `c676cc493343424f8607e16ef23a187a`,
which reported `PlayStation 4/14.00`. The operator separately checked 14.00
under Settings → System → System Information. The page stayed responsive and
connected after the identity checks. Each result passed
`python -m fw14lab.verify`; the capture and queued source hashes are retained
in the local evidence archive.

| Probe and command | Capture SHA-256 | Observation |
| --- | --- | --- |
| `canvas_getcontext_control_v1`, `2b5c46246f9f4a85939a07dfdb7ed799` | [`c7a2e3fc71834146bb374de5812478ec`](../captures/c7a2e3fc71834146bb374de5812478ec.json), `1b6035eb0575f5e0d6be618c2672214115355e1911e7955d8deb1ff6e9bb1393` | Ordinary repeated 2D `getContext` returned the same object. The proposed `alpha` and `colorSpace` getters were not read, so this initial getter-selection control did not exercise reentry. |
| `canvas_settings_inventory_v1`, `84516981b2b247c0a0ab31fabf661005` | [`5b2de8b5c2f44d57bddddb4414306751`](../captures/5b2de8b5c2f44d57bddddb4414306751.json), `b68abda109da9859b9b5667708dad2f5edc540bf0c44203ac27201b79179cd77` | 2D creation read `desynchronized` once; bitmaprenderer read `alpha` once. WebGL/WebGL2 produced no context in this check. |
| `canvas_getcontext_reentry_v1`, `230722b6a309442eafd6a9b10721d0d9` | [`7170cd88a62f4190bfc8132cf5647b7c`](../captures/7170cd88a62f4190bfc8132cf5647b7c.json), `dbe14edbf85b6f95701ba2ca4731cef4139d68182ab8420e66c756ed9fae8990` | `desynchronized` getter ran once and created an inner 2D context. Outer `getContext("2d")` returned a **different** wrapper. A subsequent 2D call returned the outer wrapper, not the inner. All three phase markers arrived. Both wrappers remained rooted in the page. |
| `canvas_cross_context_reentry_v1`, `f843a7ce963845a4821ad873e0f3017b` | [`80aad598ab794540acd491e4d7cb1bea`](../captures/80aad598ab794540acd491e4d7cb1bea.json), `ef9ed83250cd1011324b577d6dcf2f444312ede31ea1cb45a3d6a5f758ea3176` | The 2D options getter created an inner bitmaprenderer context; the outer 2D call still returned a 2D context. Subsequent calls found 2D and no bitmaprenderer. All three phase markers arrived. Both wrappers remained rooted. Under the fixed behavior, the outer call would return null and the bitmap context would remain. |
| `canvas_displaced_wrapper_call_v1`, `c77aac98883848ec98c302da690c742e` | [`eabce31bd80940b1a66425826b777ecf`](../captures/eabce31bd80940b1a66425826b777ecf.json), `bb708ab6d89099afe37111a8bd760b4c0875115c303e31deb9d0d1699a79660b` | A normal 2D `fillRect` and one `fillRect` through the retained inner wrapper both returned; all four markers arrived. This does not establish that the displaced native object is safe or that the draw affected pixels. |

The capture's `status: fail` on the two reentry identity checks means the
expected single-context invariant failed; these are valid completed captures,
not harness errors. The initial `canvas_getcontext_control_v1` status is
`fail` only because its candidate getter names were not accessed. The later
inventory established the reachable getter before either reentry probe.

## Interpretation and limits

Two independently shaped reentries cause the outer call to replace a context
created during dictionary conversion. This is a stronger PS4-specific signal
than an unexplained memory warning: it measures the exact invariant violation
that WebKit fixed for a UAF. The published Sony source has the same vulnerable
control flow, and the live behavior is consistent with it. The source archive
is only labeled 13.00+, however, and the browser binary has not been
fingerprinted. The observed wrapper call returned; no native fault address or
heap effect was measured. Treat this as a **high-confidence browser UAF lead**,
not a demonstrated exploit or kernel access.

The next decisive evidence would be the running 14.00 WebKit module bytes or
a native crash/debug trace tying the retained wrapper to freed context memory.
Repeated memory warnings or raw JS exceptions alone would not establish
control over native memory. Keep the old project outside this investigation.

The ignored evidence snapshot
`evidence/2026-10-19-canvas-reentry-final.zip` contains all 36 then-current
raw captures, 74 exact probe snapshots, and a consistent SQLite backup.
Its ZIP SHA-256 is
`0ff932dbcb67d739c98d573c6321999d63ad932349fa28691d17d29061933ca2`.
