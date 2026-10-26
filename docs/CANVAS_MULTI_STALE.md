# Multiple stale canvas wrappers on PS4 14.00

The 2D canvas reentry described in [the native follow-up](CANVAS_NATIVE_FOLLOWUP.md)
can leave several distinct JavaScript wrappers pointing at one later-created
2D context. This is stronger allocator control than the original single
stale-wrapper observation: on three independently refreshed pages, four of
eight displaced wrappers read back the same new canvas. On a fourth page,
three converged. The result is a controlled, repeated native-object alias
through stale wrappers. It does not establish arbitrary-address access.

## Exact live observations

The retail console version was checked in Settings as 14.00. Each completed
capture below passed `python -m fw14lab.verify`. The page and collector record
the PS4 user agent, command, source and manifest hashes, and served page hash.
The source snapshots are in `control/probe_blobs/` and the human-readable
versions are in `probes/`. Session IDs distinguish fresh-page runs.

| Session | Command / capture | Observation |
| --- | --- | --- |
| `9d075fa67f0e4d31abcd82c1ef46e5a3` | `75768514921c439bb4cc104a0712a386` / [`c96bcf4f2eb847308244c5176a979b6e`](../captures/c96bcf4f2eb847308244c5176a979b6e.json), SHA-256 `87dbe91bfca92caa28141f76b855170c35990f56c717dbdc462dd1ba020a4623` | Eight displaced wrappers were distinct; four reported fresh canvas index 17 after 18 fresh allocations. |
| `5646c4a00ecb4793a66d9c9e7ac7640b` | `f58a905c6ed1419e926ddf01077f9e5b` / [`f8d910c656c745049874e7f17b2170f5`](../captures/f8d910c656c745049874e7f17b2170f5.json), SHA-256 `66c732a8846aa094e9449c01309cfcb6fd65dd4e20823459be5726a7543a3777` | Four distinct stale wrappers reported fresh canvas index 18. |
| `9fb922faedf54d14a139a73f3e2dc3da` | [`43c718c4972e46a7812368d0bf2da890`](../captures/43c718c4972e46a7812368d0bf2da890.json), SHA-256 `0ef35a1e64e72ff344d751f8a9335742a8f49b2ece26857261cfda0bb46cafb0` | Four wrappers reported fresh canvas index 17. |
| `027571b4bbca46dcaee5f4c522087426` | [`11d455e6e96747f689924ec353090c4c`](../captures/11d455e6e96747f689924ec353090c4c.json), SHA-256 `4df0f63e6cdb720eddad639d2c600ebd04310b8887e299c6dc2a09628b473a05` | Three wrappers reported fresh canvas index 18. |
| `d28c2dc1bbec48acae46b7c88d562a93` | `b17e801d90804b16b4d2350bce3e0cb0` / [`9fe1762f51b04b5c96d4afb854ec1e35`](../captures/9fe1762f51b04b5c96d4afb854ec1e35.json), SHA-256 `ab55d1d5b99fa0189044e6db2418045dbc6db455ad86d8690f62c19b078192b7` | Three distinct stale wrappers reported fresh canvas index 17. |

`canvas_multi_stale_alias_v1` builds eight reentrant 2D canvases. For each,
the options getter creates the inner context and the outer call replaces it.
It retains every wrapper and creates up to 32 ordinary new 2D contexts,
stopping after it finds at least two aliases. The test compares the stale
wrapper's native-backed `canvas` property against each new canvas; it also
checks that the stale JavaScript wrapper objects are distinct. This means
the four-wrapper result is a lower bound for that allocation sequence, not a
claim that four is the maximum possible.

## Finalization comparison

On session `5646c4...`, a rooted-wrapper control applied five batches of
10,000 small allocations while keeping all eight stale wrappers alive. It
completed, retained four aliases, and drew an opaque green pixel on the
target: command `c814edfd52404944bb5e1cfa878394f7`, capture
[`1824ee7c5a9542a2bbe3c7182277557e`](../captures/1824ee7c5a9542a2bbe3c7182277557e.json),
SHA-256 `c71f08cf8a4b39459faf2579071c7ecb9d8f2cb3742c6d9d9707ec7b483de562`.
On that same page, `canvas_multi_stale_release_v1` released all four aliasing
wrappers while retaining the target canvas and ordinary context. Markers
`before_multi_release`, `multi_wrappers_released`, and `multi_gc_batch_1`
arrived for command `cca1a1d5d9584a988c9c9bed4324a951`, then reporting
stopped and the operator saw a system-memory warning. An independent fresh
page with four aliases behaved the same way on command
`0adf7382c56446cfa023122f230d824d`. Neither released command produced
a result capture. The last marker only bounds the interval; it does not
locate the native fault or establish how many wrappers finalized.

On session `027571...`, a two-wrapper release completed under the same five
pressure batches, with one alias still rooted. Capture
[`fbd395ecf53943b9aea2f34106a52cd8`](../captures/fbd395ecf53943b9aea2f34106a52cd8.json),
SHA-256 `f1e25fab33e587478da024e332440732fe9e89acfc8960f2fe462df1729f1ccb`,
reported both released wrappers still weakly alive and zero finalizer callbacks
at the time of capture. The later last-wrapper probe, command
`da2231fdcee446dfa63ad9eda16e4342`, was claimed but sent no marker or
capture; the operator reported another memory warning. Its first marker was
*after* scanning stale `.canvas` properties, so this run cannot distinguish
an earlier asynchronous finalization from a read during the scan or later
release. It is not a clean release-threshold measurement.

The most useful same-page control came from session `d28c2dc1...`, with
three aliases to a new context. `canvas_multi_stale_release_nonalias_control_v1`
released three *non-aliasing* stale wrappers, kept all target aliases rooted,
and ran identical allocation pressure. It completed with the target green
and functional: command `1cbdfcf834e14bf5a07964714adeab5b`, capture
[`bebbbf096e6548a599ca00987cc2c437`](../captures/bebbbf096e6548a599ca00987cc2c437.json),
SHA-256 `34797dc86d1f63ee7774cdaec77d56de6361a7af173ddbd8625527e71149a8e3`.
At capture time, those three released wrappers were still weakly alive.
The next read-only liveness check found all three dead with three finalizer
callbacks while the target aliases remained rooted: command
`62291bdeabcb4695b2d9f652e6ff5288`, capture
[`3a422130681841c087af871925523b5f`](../captures/3a422130681841c087af871925523b5f.json),
SHA-256 `b364fb82c9d0bbda21451095d71d45b9e9661f04be4e572fdc22bc26329e9e4b`.
This proves ordinary finalization of three displaced wrappers can complete
on the page without losing the target context.

The subsequent `canvas_multi_stale_release_marked_v2` released all three
target aliases. Its eight markers arrived through `alias_gc_batch_5`; capture
[`799cea81daf44136bc93655a16fdce02`](../captures/799cea81daf44136bc93655a16fdce02.json),
SHA-256 `b91d2dafa95a07ae38399df87388f75a3c914d85312b467fcc697e43b67d7ce5`,
reported the target still functional, three released aliases weakly alive,
and zero callbacks at capture time. Polling stopped immediately afterward,
and the operator saw a system-memory warning. The warning is associated with
post-capture collection of the alias group, but the exact finalizer and
native fault are unobserved. The same page had just finalized the three
non-aliasing wrappers without a warning.

## Mechanism and remaining discriminator

The [upstream WebKit fix](https://github.com/WebKit/WebKit/commit/040ef6e21ffac03b6d6098e0e12354bdb5469ad1)
identifies a use-after-free when a displaced native 2D context's JS wrapper
is swept. Sony's public 13.00-and-later source has the vulnerable replacement
flow. Its `CanvasRenderingContext::deref()` forwards to the context's canvas;
after slot reuse, several stale wrappers could therefore decrement the new
canvas's reference count. This is a source-based explanation for the
release-specific warning, not a native trace from the 14.00 binary.

The decisive next observation is the target-alias wrappers actually becoming
weakly dead, followed by a directly measured target lifetime or native memory
effect. The warning alone does not reveal the faulting instruction or yield
an addressable memory read/write. Exact 14.00 browser module bytes or a native
crash trace would allow the source mechanism to be attributed more precisely.

The `Range` discriminator produced a controlled lifetime difference. In
Sony's same public archive, `Range.h` owns two `RangeBoundaryPoint` values,
and `RangeBoundaryPoint.h` retains each container as `Ref<Node>`. On a fresh
page, `canvas_multi_stale_alias_v1` found four target aliases: command
`204892b370a34718ba90fc9cea5033a3`, capture
[`a66da00369494bdd92ffc75eb89a14fb`](../captures/a66da00369494bdd92ffc75eb89a14fb.json),
SHA-256 `6894cec27a201d09e52d7c32eefed58c7dfd76ccedf436ce0fa29f438185a9f4`.
`canvas_multi_stale_range_refs_v1` then bound eight live DOM ranges to the
new target canvas *before* releasing all four aliases. All four stale
wrappers finalized and became weakly dead, while the target context still
drew a green pixel and eight range boundaries still referred to the canvas:
command `e36f3682130943f1b739033a6b82716f`, capture
[`14ed5dfaecaa4a1fbe675b5184bc46d0`](../captures/14ed5dfaecaa4a1fbe675b5184bc46d0.json),
SHA-256 `72b18d5017b87de989f718b91d42ffa720bd5cff926a51bb6b757c341540139a`.
An independent command on the same still-polling page confirmed the four
wrappers remained dead, all eight ranges bound, and the context drew blue:
command `30f2dbc9fc1e4b29b9f92197b9ff6d5f`, capture
[`28cbb3fcfc214034a2ded67218e0fb3b`](../captures/28cbb3fcfc214034a2ded67218e0fb3b.json),
SHA-256 `e6840effd88d2bee234b1350540ae231900553638d0adc279f0a8cd62a93e483`.
Both captures passed verification.

These results show that extra target references can keep the canvas usable
through collection of four stale wrappers, whereas the matched no-range
release sessions yielded warnings. That supports an over-decrement of the
target canvas in the public source model. A native reference count was not
directly read; range allocation and GC scheduling are additional variables.
Reducing the range roots in steps is the next causal check.

On that same page, removing four of the eight ranges completed. A separate
check found all four removed ranges finalized, four still bound to the target,
and the context still drawing cyan: commands `54ef716d30174d7bb3dd77845030983a`
and `791d0b572f504bae9350fabd43fa9561`, captures
[`21d38ffac7d14f88a6af875de6145acd`](../captures/21d38ffac7d14f88a6af875de6145acd.json)
and [`efebb4df62584c54802d1bb53fa1e1a4`](../captures/efebb4df62584c54802d1bb53fa1e1a4.json),
SHA-256 `2239464f9978bb665d855551808def8bcd34db6a922cc44dd4a934dddca48ffd`
and `409f7e4d1edd21b09f6122bfa5898ac4f762f98ccac27179d2c8a5488f9e9296`.
Removing two more also completed; its follow-up found both newly removed
ranges finalized, two still bound, and the context still drawing cyan:
commands `651d551d5d8f4569aee4018edb9ba54b` and
`2cc3d7522e3e4e35a8f4481d55f92fef`, captures
[`a3d7cafd302d4f53a6ec2740dc5011ee`](../captures/a3d7cafd302d4f53a6ec2740dc5011ee.json)
and [`516008253dec4fb49d14fb4349e8214c`](../captures/516008253dec4fb49d14fb4349e8214c.json),
SHA-256 `5c86e973f8820be686b68758468cacaa3f23eb6c9f78a0470fe377d70146ddbc`
and `6044e2ec57427eb28b1b0fdc979bedf7f9c5b0d23a0d1c018e7be48065e2b8b4`.
Thus the canvas remained usable after six of eight range objects had been
independently finalized, with all four stale aliases already finalized.

A seventh range was released by command `afbfeb620e9a414389d2e30a35f58fb4`;
capture [`4186f05f2e9f494d8ca546c73e3d86cc`](../captures/4186f05f2e9f494d8ca546c73e3d86cc.json),
SHA-256 `5c7bf4c733a20ebea92d2c1961bef748e8700f291d9e1acfd4baa4de40d112d4`,
reported it still weakly alive and the target drawing orange, with one range
still bound. The next liveness command `8ecb9d4b0e104373bd0d3dc3db2a47a4`
sent `before_drop_liveness` but no result; polling stopped. The operator's
on-screen outcome was pending when this record was written. The seventh
range's finalization is unobserved, so this is not yet a measured threshold.

The ignored archive
`evidence/2026-10-19-canvas-range-reference-control.zip`, SHA-256
`91034d023bd0fa47d97d4db554b4a0e7163ae4ee9898d620d5a9703f7002feea`,
contains 76 raw captures, 144 exact source/manifest snapshots, and a
consistent SQLite backup. Its ZIP entries passed the integrity check.
