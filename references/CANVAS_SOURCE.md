# Canvas context reentry source provenance

The ignored local file
`upstream-webkit/Sony-616-1300-HTMLCanvasElement.cpp` was extracted as one
ZIP member from Sony's
[PS4 WebKit source archive page](https://www.playstation.com/en-us/oss/ps4/webkit/):
`WebKit-616-1300.zip`, member
`WebKit-616-1300/Source/WebCore/html/HTMLCanvasElement.cpp`. Its SHA-256 is
`2455ac5a07e66ac803d101e195af33c7b7a0bd330c29808fdf3eceb6a2d77787`.
The archive is labeled **13.00 and later**; that label does not prove byte
identity with the running 14.00 browser. The extraction used
`tools/remote_zip_member.py` and did not involve the old project.

Additional members extracted from the same public archive:

| Local member | SHA-256 | Relevant definition |
| --- | --- | --- |
| `Sony-616-1300-HTMLCanvasElement.h` | `f35ad6bb4c70c7a44837f18feaa2492a9c55afd9343b390f46a3f8b037337e23` | Owns `m_context` as `std::unique_ptr<CanvasRenderingContext>`. |
| `Sony-616-1300-CanvasRenderingContext.cpp` | `da48233def59259b9f6d911204e1bf69a9cce9044a366b5b2d9de1a0cdc272b5` | `ref()` and `deref()` forward to `m_canvas.refCanvasBase()` and `m_canvas.derefCanvasBase()`. |
| `Sony-616-1300-CanvasRenderingContext2D.h` | `8f70f01669e1177d51215a0e4be07fbe79df90ba2cc6c0ea54860d5e12672df2` | The 2D class has an ISO allocator; `canvas()` returns the canvas from the native context. |
| `Sony-616-1300-CanvasRenderingContext2D.idl` | `e3f6e9de7d6219b7aee07fe192630f9181a47146fc923829f1434fe766afcdc5` | Exposes `readonly attribute HTMLCanvasElement canvas`; no `SameObject` annotation. |
| `Sony-616-1300-ImageBitmapRenderingContext.h` | `5e8eb6cb998096edb6f43d9da99a09169a41ce7d86330ff47a16f3bbbf644b31` | Bitmap context is also ISO allocated and created as a `std::unique_ptr`. |
| `Sony-616-1300-ImageBitmapRenderingContext.idl` | `705febefdaa7e3d186fda7cd5263ddfba9a4917e745dc44644e4cdbcca5d612b` | Exposes its canvas through an uncached IDL attribute. |
| `Sony-616-1300-Range.h` | `0b9c022e22a6c0a0ba7f8d66fa3fb47ea20684d561aa59d1c0b2d49e9d6ba5f2` | Owns `RangeBoundaryPoint m_start` and `m_end`. |
| `Sony-616-1300-RangeBoundaryPoint.h` | `0c87941d48864eaa4438b5de587bc95419596b0a2414f1075b77886d67e053a9` | Each boundary retains its container with `Ref<Node> m_container`. |

The live 2D wrapper's changing `canvas` relation is consistent with reuse of
the freed 2D context slot because this source implementation reads the canvas
from the native context. The exact 14.00 binary has not been measured.

The upstream security fix is
[WebKit commit 040ef6e21ffac03b6d6098e0e12354bdb5469ad1](https://github.com/WebKit/WebKit/commit/040ef6e21ffac03b6d6098e0e12354bdb5469ad1)
for [bug 313175](https://bugs.webkit.org/show_bug.cgi?id=313175). The
[WebKitGTK/WPE advisory](https://webkitgtk.org/security/WSA-2026-0004.html)
maps that bug to CVE-2026-43720 and describes it as a use-after-free. Those
upstream records explain the hypothesis; the console captures in
[the finding](../docs/CANVAS_REENTRY_FINDING.md) establish the separate PS4
observation.
