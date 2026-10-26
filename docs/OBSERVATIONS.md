# Browser observations: 2026-10-18

Evidence label: `observed-14.00` for console version, based on the operator's later report that **Settings → System → System Information** displayed 14.00. The operator also supplied `14.00` on the page, and the browser sent the user agent `Mozilla/5.0 (PlayStation; PlayStation 4/14.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15`. The Settings result is a verbal observation rather than a captured screen, and does not identify the running WebKit binary revision or kernel behavior.

| Capture | Submission SHA-256 | Method | Direct result |
| --- | --- | --- | --- |
| `fa93a68d4c284427be0345dfc95ef056` | `15fcd2cded4c2c783be25ee1375201a95423dc91097f3536dfc63bb7b8fa216b` | Manual baseline, schema 1 | Typed-array values `18,52,86`; MessageChannel nonce and payload matched. Both checks passed. |
| `e02ea49c10314e0aa6d595a48ef8a40d` | `6074a8dd3844b604970ef8915a4027bf526b0e3d3011a3e28109753800301385` | Remote `runtime_inventory_v1`, schema 2 | `BigInt` and `structuredClone` exposed; `WebAssembly` and `SharedArrayBuffer` not exposed; `crossOriginIsolated` false. |
| `72df5de60bd04c3487e88ff4a38b622f` | `f34430ec5601304c2f099ec9c0102591882e0b5a67182f830ee0f87a19ee84ac` | Remote `baseline_repeat_v1`, schema 2 | The same two baseline checks passed. |
| `d52b28fbdc8240c7a2ad875e0c873ed6` | `a3e7f7a2d36540c4cbaa89993f6d1812045da36fbafdfa3d9a8b045325c2d39a` | Remote `structured_clone_smoke_v1`, schema 2 | Ordinary object and ArrayBuffer copies, ArrayBuffer transfer, cycle preservation, and function rejection all passed. |
| `03ba8fd762bf44d3b2cda7fcd3b86ff8` | `fd483b5681542e959aba437c70b6c9a31b490b9ee956fd2c560d5beac80b885c` | `clone_graph_identity_v1`, schema 3 | Repeated object reference became a BigInt when preceded by a BigInt; ordinary alias and distinct-object controls passed. Cycle, Map/Set alias, and MessageChannel cases with BigInt also failed. |
| `9c5faf002f8648b08d593390ba8c5f00` | `2caaaf28e260b63cf1ef326de0ad09e4244aae151fcc3426d19e7f14440381e8` | Exact repeat of `clone_graph_identity_v1` | Same statuses and details as the first run. |
| `b05e1b55c1c248bb9ba55f6f56ffb9ec` | `0a621b256ffb4b0a82d131df6e0dbcb707945356fa2ba3494a0170986bad842d` | Separate `clone_pool_minimal_v1` probe | `[17n, shared, shared]` produced `17n` at the second reference. Number prefix, BigInt suffix, and BigInt between the two references preserved identity. |
| `7667a23c7004410182b63cb9586aa23d` | `f1f95a0a2f0269020cd675de6879d3fd95bf928d4d8a4adaae7bb00d392a78b7` | `clone_mapset_controls_v1` | Map/Set references passed without a BigInt and failed with a BigInt prefix. Repeated Map and Set themselves passed without BigInt. |
| `abb6d4d728f24df3b8132834009f67ef` | `e94c34097e2ffc606bf3f04fc14537cefaec043dbc7924a63221a9f796e0d3cf` | `clone_prefix_matrix_v1` | A BigInt prefix broke the object alias. Number, Map, Set, Date, RegExp, ArrayBuffer, and typed-array prefixes passed for these small graphs. |
| `e46cf68c590a47f0a29c990b448c71e9` | `6e1a235b9a4ea796d79390a0ccf875f74453a04eba0efac995fe3e8ccf7fc43f` | `clone_reference_shift_v1` | With BigInt and one or more filler objects, the repeated target's marker matched a preceding filler instead of the target; no-BigInt controls passed. This probe did not compare identity to each filler. |
| `e771d9a5cfdb46048b91826ca75ce96c` | `b4126cfe3c57d366b0892315c45f9a28482e8ec4137c026109f97ffb58dc20a8` | `clone_object_substitution_v1` | Direct identity comparison proved `[23n, filler, target, target]` cloned with the repeated target equal to the cloned filler, not the cloned target. Number-prefix control passed. |
| `314e9a6bd5924fe295039c7437a33426` | `cd51b20f1d3dd6dfab13f65627d9c5de71248bfef027966645141b511a4b2ec9` | `clone_view_buffer_identity_v1` | A typed-array view of the second 8-byte buffer instead pointed to the first cloned buffer after a BigInt. An in-bounds write through it changed the first buffer; the number-prefix control wrote to the second. |
| `0a18b34c1e254c348e947a55ec2aa1d4` | `b0d2c1797de15aa302d94bc144abb86bc83dc237b2c6661435fcc0c34b370f8f` | Exact repeat of `clone_view_buffer_identity_v1` | Same statuses and byte values as the first run. |
| `5de5a37bb2f54475840a96e8876f2244` | `f602c4df377d14c3fbc7e0653f2941acaf6361beff5851046e41633ea081b5e8` | `surface_inventory_v1` | FontFace, DOM, Canvas, and messaging APIs were exposed; WebAssembly, WebGL, and IndexedDB were not exposed in this page. Presence checks only. |
| `98dffa89a2db4e5ea52f3a8af586ce33` | `fd9e3ebe6c10f59270b899c1bb4faf57101a7b54976e96b62ed5678a531d8d63` | `regexp_unicode_backref_v1` | Six bounded 600-iteration cases all matched the upstream regression's expected outcomes. This did not show the CVE-2026-43740 logical failure; JIT settings and other variants remain unknown. |
| `5651264d656449b495ce5d99501093c9` | `2fa56a5db1c3e90b2821df4aa7b54fb161cc74b0c02e7b1b2934ee1242f3ea99` | First `streams_inventory_v1` draft | Probe-format error: overlarge details object rejected by runner. No browser defect inferred. |
| `cbf52d60fbd9435982d40c4289f6cf0d` | `edec253ef57b6d017ad116d06daf5c3edbb29737ba62ed7d699a937f5591fbee` | Corrected `streams_inventory_v1` | `TransformStream`, `ReadableStream`, and `WritableStream` all exposed as functions. |
| `b41aa26bc8ed4075bc1799e56a49b8da` | `26b4671736f4b1c3c260b2b3d6175c23752cddf7279b55e743c6530854ef0084` | Benign `transform_stream_iterator_v1` | `new TransformStream()` succeeded and invoked the overridden array iterator twice, once on an array of length three; the wrapper returned original values. |
| `de5be36a80cd47e9b038c2cc181d53ce` | `b7726ae36ef2283801af345930c67a0b070a8315482efd44e5a22b0ff6f49682` | `marker_round_trip_v1` on a fresh session | `api.mark("round_trip")` was durably received and the result capture passed. |
| `7632eb5d237144fca5c2fea0b96e4810` | `ab834d8bd002fe7e5876c0ad70bc902f7604329950af5daff3587bfec1b8d3e9` | `transform_stream_iterator_v1` after the first memory warning | Ordinary TransformStream construction passed; a length-three array iterator was called once. |
| `192c21dfd5fc4105b24e2b83e0ae95fc` | `b3daedcc7ce297784cf906c70305894b01a3d9106fdac552dd1813dc8f3341db` | JavaScript-only `array_iterator_short_control_v1` | Shortened a three-item array to one value and returned normally. |
| `e6390843ba474134ba7d19d88adf1d08` | `9d68981ca008cc79c414285151100a7180b9f1f0f5cef2c715a45d32ab2059b1` | JavaScript-only `array_iterator_wrong_type_control_v1` | Returned all three array elements with an ordinary object substituted for the second; one replacement counted. |
| `315af29282ad40df81940bfa245adbe8` | `b04ea8c6323238272aa8d41acb8e9b667bae6e12eec659704a407d51568ca746` | `iterator_sync_marker_control_v1` | Synchronous marker from inside a three-element array iterator reached the server; the benign Array.from result passed. |

The initial remote captures came from session `ac3401a0563d49adb021272330b26d67` and commands `e11f610479f6418ab6c4c56f3a38c506` and `7c07c0ff6b8847b0b40ae808bb7fd94d`. Both record served page asset digest `b715d159691f0366480d4b14a4cef1b81b181ec8e6ae8bb811464cc135769e3a`.

The clone smoke capture came from session `d4ecd48991494289ace54580bbddd3a9`, command `8c29e9ec62e04873b4c1d57d3f2a5b66`, and served asset digest `2f99e93061c9dfcace12c302e2a38f1830de5083185de82bc5af7ff7297fc8c4`. Its raw file also passed `python -m fw14lab.verify`.

The schema-3 clone probes came from one session, `a049c0d73e2049f38d9ba9be445f7701`, runner version 1, with served build digest `feeaf116a7e45366f3cdbe0f053673bd93e12498452d51b7a79f4c5620d02b77`. Repeats therefore show consistency in that session, not independent device or browser-build reproduction. Each raw capture is in `captures/`, records its exact probe-source and manifest digests, and passed `python -m fw14lab.verify`. The table's SHA-256 is for the canonical submitted JSON, not the whole on-disk capture file. The corresponding source files and manifests are in `probes/`; immutable snapshots of the bytes actually queued are in `control/probe_blobs/`. The browser's submitted times were about 29 seconds ahead of the PC receipt times, so treat the client clock as unsynchronized.

The [clone-integrity finding](CLONE_INTEGRITY_FINDING.md) explains the minimal reproduction, controls, and limits. The [January 2024 WebKit fix](https://github.com/WebKit/WebKit/commit/010c6bdfb0cde0485d31f0260ab9a046fa9b8567.patch) is a strong mechanistic analogue, but is not a fingerprint for this console. The [HTML structured-clone algorithm](https://html.spec.whatwg.org/multipage/structured-data.html) requires repeated references to remain repeated. The live failure establishes browser-visible value corruption and wrong-buffer writes **inside cloned buffers** for these inputs; it does not establish native memory corruption, arbitrary native read/write, code execution, or a kernel path.

The [TransformStream hypothesis](TRANSFORM_STREAM_CANDIDATE.md) records a one-shot native-type-guard probe. Command `a96521cd1f5544f7abd14c75eb807afe` was claimed at `22:21:19.317786Z`; no capture followed, and the session last heartbeat has that same timestamp while the server remained healthy. The operator later found the PS4 in Rest Mode, but did not observe when it entered Rest Mode. The cutoff is therefore indeterminate and supplies no affirmative crash or native-memory-safety evidence.

In a later session, command `5d552cdfeb7f4374b667dbdc37e54d42` for `transform_stream_iterator_throw_v1` was claimed at `04:38:40.007064Z` on 2026-10-19. The server received its `before_iterator_throw` marker at `04:38:40.042504Z` but no result or subsequent poll from that session. The operator reported an immediate “There is not enough free system memory” warning; the browser stayed open, and **Settings → System → Error History** had no browser entry. A new remote session appeared afterward. Command `384e78dbb90c4e51b727718ab0634867` for `transform_stream_short_sequence_v1` was claimed at `04:43:38.159943Z` on that new session; its `before_constructor` marker arrived at `04:43:38.196708Z`, but no result followed. The operator observed the same immediate warning, pressed OK, and reported that the page refreshed and stayed responsive. Both warnings are temporally associated with abnormal TransformStream iteration, after normal controls passed; neither marker alone proves the altered iterator executed.

The watched wrong-type command `52b780fa23c944ed9bd1608db53e46a9` was claimed at `04:52:30.399672Z` on 2026-10-19, with its `before_constructor` marker received at `04:52:30.436188Z`. It returned no result; the operator saw the same immediate memory warning and page refresh after pressing OK, and found no new browser entry in Error History. The updated page then ran a passing synchronous iterator-marker control, capture `315af29282ad40df81940bfa245adbe8`, on session `91a51f85140e4ab69bd73aef11903be0`. On that same session, `transform_stream_type_guard_marked_v3` command `2c8f6b76026443e2833098d571159ff8` was claimed at `05:02:29.268914Z`; the server saved `before_constructor` at `05:02:29.312577Z` and `inside_replacement` at `05:02:29.336407Z`. The operator immediately reported another memory warning. There was no result or further poll, and a page GET arrived at 05:02:41Z. The inner marker establishes that the JavaScript callback reached the substitution branch, just before returning the altered second value.

The full-sequence follow-up `transform_stream_full_sequence_marked_v4` command `baa0d982d3334b7d895e8ca588d52b73` was claimed on fresh session `bf70ef4114c9451ea175c6cea735392c` at `05:08:15.151638Z`; source SHA-256 `ce044376c26233c8c0ecd847bfa0b9d5497f08fdc94b946628dd239b65fd03b9`. Its markers were received in order: `before_constructor` at `05:08:15.198713Z`, `inside_replacement` at `05:08:15.231346Z`, `third_value` at `05:08:15.247727Z`, and `iterator_done` at `05:08:15.262382Z`. No command result or further poll arrived; a new page load began at 05:08:22Z. The operator watched the same immediate memory warning, pressed OK, and reported a page refresh. These markers demonstrate that the three-item iterator completed after reaching the wrong-type substitution branch. If Sony's public source matches this browser, its short-vector fatal bounds check cannot explain this run. The faulting instruction and binary revision remain unknown; the published `JSCast.h` instead makes a null dereference a plausible explanation. This is not evidence of controlled native read/write. The latest ignored `evidence/2026-10-19-transformstream-full-sequence.zip` contains all 23 raw captures, 44 probe snapshots, and a SQLite backup (SHA-256 `96b41781a25a178fb31a6149ba7203c90b16157f3e335a62ba26709ff6a7e9f0`).

On 2026-10-19, command `006afb1a640c462795863914bece4d78` ran `transform_stream_cast_discriminator_v1` on session `8145a3d7d7f84c118e2a3c3ad5889101`. Markers reached the server through `arm2_replaced` (`05:19:44.198558Z`), and the genuine-`ReadableStream` arm had returned at `05:19:44.181376Z`. The operator then reported a system-memory warning; no `arm2_threw` marker, result, or capture followed. This is a marker-only record, not a capture, and it is absent from the table above. Details and the source-model correction are in [TransformStream finding](TRANSFORM_STREAM_CANDIDATE.md#discriminator-arm-2-result-2026-10-19).

## Separate font-loading path, 2026-10-19

The user moved research away from TransformStream. The [font-loading lead](FONT_FACE_LEAD.md) contains the source comparison, exact controls, hashes, and limits. On the Settings-confirmed 14.00 console, `font_face_load_control_v2` capture `9f1b6f5e58c4405cab03a7a17b9459e7` showed one synchronous `FontFace.prototype.then` getter call for each local Helvetica and Arial load. `font_face_reentry_marked_v1` command `9b2d39f701bf42499b9759c31d7578fc` then saved `before_font_reentry`, `font_getter_entered`, and `font_layout_returned` markers. No capture or further poll followed. The operator reported an immediate system-memory warning and page refresh; Error History had no new Internet Browser entry. Removing the same stylesheet after the load returned passed in capture `d181cfa74e6c4e5ba0286257e7203f03`. A separate control with a synchronous marker *inside* the getter but stylesheet removal afterward passed in capture `5eb56701a0db45c6a0e79984f0313d80`. These observations isolate reentrant style mutation as the differentiator, but do not establish the faulting native instruction or a memory primitive. The latest ignored evidence archive is `evidence/2026-10-19-font-face-isolated.zip` (SHA-256 `5132090241fcc4e0e2e2e44299f511ce4855d998f381838ea72a4f6e80eb1e0c`).

## Focused matrices, 2026-10-19

The [focused matrix record](BRUTE_MATRIX_2026-10-19.md) indexes four new captures. A 96-case, 600-iteration-per-case Unicode backreference matrix passed on the console. The first clone view-size run yielded only a collector marker-limit error. Its corrected run found that an undersized mistaken backing buffer caused the cloned slot to cease being a view; at or above the exact required length, the view attached to the wrong buffer but stayed within its reported bounds. The one-byte-short result held across Uint8Array, Uint16Array, Int32Array, Float64Array, and DataView, with passing number-prefix controls. No out-of-bounds view or other native primitive was observed.

## Canvas context reentry, 2026-10-19

The [canvas reentry finding](CANVAS_REENTRY_FINDING.md) indexes five new
captures from session `c676cc493343424f8607e16ef23a187a`, all using the
same served page digest `7bb50b094df2aaee3f7d903942df88af1b6c86014946fa08a2e5cfdcc79cbc2b`.
The first control found that ordinary repeated 2D `getContext` returned the
same wrapper, but its candidate `alpha` and `colorSpace` options were not read.
An inventory then found a reachable 2D `desynchronized` getter and a
bitmaprenderer `alpha` getter. The same-type reentry capture
`7170cd88a62f4190bfc8132cf5647b7c` shows inner and outer 2D wrappers
were distinct and the outer became the current context. The cross-type
capture `80aad598ab794540acd491e4d7cb1bea` shows an inner bitmaprenderer
context created in the getter was replaced by the outer 2D context. All
expected markers and both captures arrived. One call through the retained
inner 2D wrapper returned in capture `eabce31bd80940b1a66425826b777ecf`;
it did not produce a visible failure. The operator reported the page remained
responsive and connected after the identity tests.

These two replacement results match the pre-fix path described in WebKit bug
313175, whose published fix identifies a stale wrapper and UAF on GC sweep.
The Sony 13.00-and-later source contains the same missing post-conversion
check, but no running 14.00 browser binary has been matched. These initial
captures establish context replacement; the follow-up below establishes a
controlled cross-object canvas write. Exact commands, digests, and source
provenance are in the finding.

The [canvas native follow-up](CANVAS_NATIVE_FOLLOWUP.md) advanced this beyond
the identity mismatch. On a refreshed page, `canvas_2d_slot_reuse_small_v1`
capture `447ca90cde6246bca1e799f50bc78800` showed the displaced wrapper's
`canvas` property change to a fresh 2D context's canvas after five allocations.
`canvas_2d_reuse_write_v1` capture `64915fde3d4b4d6d98d9504d97c57926`
then showed a distinct newly allocated canvas change from red to blue when
drawn through the stale wrapper. The original canvas remained transparent.
After another page refresh, capture `c1c60b5fce2e45ca9835fc8d8a2197f3`
repeated the red-to-blue write with an alias after six allocations. Between
those fresh-page runs, a same-page retry found no alias among 32 allocations,
so the allocator state changes the chance of reuse. Capture
`5e65644d8e88451a8fa5eee937404fb5` confirmed that the stale wrapper and
the new context's wrapper were distinct JS objects. The stale wrapper was
subsequently finalized under GC pressure in capture
`22f37f6cabdc4b139025fd52ec556785`; the retained new context still drew.
A matched target/control canvas lifetime comparison in capture
`85ef69fca2b94746a143ea5b5c95a65e` did not show divergence. The complete
source hashes and controls are in the follow-up document and the latest
ignored evidence archive.

## Multiple stale canvas aliases, 2026-10-19

The [multi-stale follow-up](CANVAS_MULTI_STALE.md) found four distinct
displaced 2D wrappers reporting one newly created 2D canvas on three fresh
pages, and three aliases on two more. Two four-alias release probes stopped
after their first GC batch, each followed by an operator-observed system-memory
warning. A matched rooted-wrapper pressure control completed and kept the
target canvas functional. On a later page, three *non-aliasing* displaced
wrappers finalized cleanly while the three target aliases remained rooted;
then releasing the target aliases produced a completed capture and a
post-capture memory warning with polling stopped. The live captures and
marker-only warnings support an alias-specific finalization hazard. They do
not measure native reference counts, the faulting address, or a usable
addressable memory primitive.

On a subsequent fresh page, four aliases were again found. Eight live DOM
ranges were bound to the new canvas before all four aliases were released.
The release capture `14ed5dfaecaa4a1fbe675b5184bc46d0` reported all four
stale wrappers finalized and weakly dead while the target drew green. A
separate liveness capture `28cbb3fcfc214034a2ded67218e0fb3b` confirmed
the target still drew blue with the eight range boundaries intact. This is a
controlled survival difference consistent with extra native references in
Sony's published `RangeBoundaryPoint` source, and is more informative than
another warning alone.

## History deserialization out-of-bounds byte, 2026-10-19

The [History native-memory finding](HISTORY_NATIVE_OOB_14.md) uses a 253-entry
graph and a crafted UTF-16 property name to turn the 255/256 object-reference
width mismatch into a forged `Uint8Array` view. A resizable backing buffer has
logical length 8; the forged view reports offset 8 and a length near `2^64`.
Capture `6619252ef8c14f68bc71e8b49a31ae36` read numeric `0` at the first
forged-view index while a normal view returned `undefined` at index 8. Capture
`d5bfce91d1184a728a45dac21d7d0d27` then read `0`, wrote `0xA5`, and read
back `0xA5` at that index. The same source and result repeated on a fresh page
in capture `f55646269ccd4407b0f8598221e1ad55`; both in-bounds canaries and
cleanup passed. This measures a one-byte read/write beyond the buffer's
logical end. The subsequent [cross-allocation follow-up](HISTORY_NEIGHBOR_RW_14.md)
mapped the allocation that owns the byte at a farther indexed offset.

## History cross-allocation read/write, 2026-10-19

The forged view read eight `0x5A` bytes at indices 65,528–65,535 in capture
`e59f8728cd214aee84097e2e2557edc6`. Unique markers in capture
`2a253888be9c44a9b30713ae1b475c5c` identified those bytes as the first
eight bytes of a distinct cloned resizable buffer, `output.filler[2]`. A normal
write to that buffer immediately changed the forged view's read. Capture
`dba3a2e1c3ff48d99f5fc0c2d81640ec` then wrote through the forged view;
the normal view read the change `0x42 → 0xDB`, and a second forged-view write
restored `0x42`. The same source and result repeated in new page session
`6de007ad992147c48365d000f85c3988`, capture
`f206e4555ac34bc1a8720b19ac3a68a9`.

Capture `90a80eae8bb7488ab512d4bf0961f0dd` mapped eight separately cloned
buffers at 65,536-byte intervals; normal and forged views both read the
sequence `66,67,68,69,70,71,72,73`. Capture
`166c6d6b028c4feb8733ed02c7ffe6b4` wrote to the eighth buffer through the
forged view at index 524,280, observed `73 → 208` through its normal view, and
restored `73`. All four captures passed verification. This is controlled
cross-allocation read/write among attacker-created resizable buffers. It has
not yet reached an unrelated native object or established WebKit code execution.
