# Canvas stale-wrapper slot reuse on PS4 14.00

On the Settings-confirmed retail PS4 14.00, same-type reentry can displace a
2D canvas context. A later 2D context allocation can reuse the displaced
native object's slot. In a completed live capture, the old JavaScript wrapper's
`canvas` property changed from the original canvas to the newly allocated
canvas. Drawing through that wrapper changed a pixel on the new canvas from
opaque red to opaque blue, while the original canvas stayed transparent.
This is a controlled cross-object canvas write through a stale wrapper. It
does not establish unrestricted addressable memory access.

## Decisive captures

Every listed capture passed `python -m fw14lab.verify`. The JSON in `captures/`
is ignored locally; exact probe source and manifest snapshots are preserved
under `control/probe_blobs/` and in the evidence archive.

| Probe | Command / capture | Observation |
| --- | --- | --- |
| `canvas_2d_slot_reuse_small_v1` | `1dc1c869bd414561aaedc59657424222` / [`447ca90cde6246bca1e799f50bc78800`](../captures/447ca90cde6246bca1e799f50bc78800.json), SHA-256 `10e00d6231deaae4402cda99856d95c2f896f2e3588d21470fc284de4b64078b` | The displaced wrapper's `canvas` changed after five fresh 2D contexts. It exactly matched fresh context index 4's canvas. |
| `canvas_2d_reuse_write_v1` | `e9b96ca0311c4afbbd0b766bc4dc1cc2` / [`64915fde3d4b4d6d98d9504d97c57926`](../captures/64915fde3d4b4d6d98d9504d97c57926.json), SHA-256 `1ef7cc2dfd7744a19c41db3c9d38a5fdaa6920560f79eebf57450dc3431e829a` | The stale wrapper aliased fresh context index 18. Its `fillStyle` was shared with that context; drawing through the stale wrapper changed that context's pixel from `255,0,0,255` to `0,0,255,255`. Original canvas pixel stayed `0,0,0,0`. All five phase markers arrived. |
| Same script, second run | `71f9cd77669942c59f507e0728b2082b` / [`fafeee131eb44decb1b0cbd87b1416a2`](../captures/fafeee131eb44decb1b0cbd87b1416a2.json), SHA-256 `45eea79b5a7c845e9bfc91ea9545f515ec44df80dd18527a620b1bb2bbd97ed1` | No alias among 32 fresh contexts in the already used page. This establishes allocator sensitivity; the first result remains a valid completed observation. |
| Same script, fresh-page repeat | `43c7b7f3124c4b8ea2e913a3f968485a` / [`c1c60b5fce2e45ca9835fc8d8a2197f3`](../captures/c1c60b5fce2e45ca9835fc8d8a2197f3.json), SHA-256 `6279d31d92b0d58c999726620ca684564da7f5b4047a88ff90f5d0bc2870c678` | Aliased fresh context index 5. The new canvas pixel again changed red to blue through the stale wrapper; original stayed transparent. This repeats the controlled effect on an independently refreshed page. |
| `canvas_reuse_wrapper_identity_v1` | `2213470db3234e7fb7504fb9fda853e9` / [`5e65644d8e88451a8fa5eee937404fb5`](../captures/5e65644d8e88451a8fa5eee937404fb5.json), SHA-256 `9792ac03f80e27c2e49b1994c3c773bf64137b3142e00eee0313e325f6842729` | The stale wrapper and fresh context wrapper were **different JavaScript objects**, although both addressed the same new native 2D context. |
| `canvas_alias_finalization_v1` | `2f5cfbb95184487d8bdeabb775864f40` / [`22f37f6cabdc4b139025fd52ec556785`](../captures/22f37f6cabdc4b139025fd52ec556785.json), SHA-256 `8bc48b2d8fc9833b44153151f104b780b63459a9c59f72b26dac5cd79ab263e0` | After releasing only the stale wrapper, `WeakRef` became dead and its `FinalizationRegistry` callback fired. The new canvas/context remained rooted and drew a green pixel afterward. This proves collection of the distinct stale wrapper; it does not by itself prove an observable reference-count error. |
| `canvas_target_wrapper_lifetime_v1` | `fb664cf214cf4d939b2d641e5d7b6c7d` / [`85ef69fca2b94746a143ea5b5c95a65e`](../captures/85ef69fca2b94746a143ea5b5c95a65e.json), SHA-256 `8c4aa26776235624cd64c87f0e60b05b6e108f553a4a237199fd3dbeb1e0e4f6` | With canvas wrappers dropped but their contexts rooted, both the aliased target and ordinary control canvas remained weakly reachable and drew cyan. No lifetime divergence was observed under these roots. |
| `canvas_bitmap_reentry_pool_v1` | `17dd396d1b424aea9502eb19b23a1939` / [`98dc9e76ad914a6b9e3126f32b46174b`](../captures/98dc9e76ad914a6b9e3126f32b46174b.json), SHA-256 `62340419932a2df41b042234659e2a286485c19baa4e0a9e1036deba4a6f8fca` | 64 displaced bitmap contexts retained their original canvas identities. The matched ordinary bitmap pool had 16 contexts. This is a negative result for that type and allocation pattern. |

The first 256-context 2D attempt (`canvas_2d_slot_reuse_v2`, command
`e3bde0ad7a134c3b9b67fcf43997f8c2`) was claimed but sent no marker or
capture. The operator saw a memory warning and the page refreshed. Its
immediate predecessor was the 64-context bitmap pool on that page, so the
warning cannot be assigned to a particular allocation or stale-wrapper
instruction. The subsequent small probe was run on a refreshed page.

## Source mechanism and next discriminator

Sony's public 13.00+ `HTMLCanvasElement.cpp` owns the context in a
`std::unique_ptr`. The outer `getContext` checks for a context, converts the
JavaScript options dictionary, then creates a new 2D context without
rechecking. A getter in the conversion creates the inner 2D context. The
outer assignment destroys it, leaving its JS wrapper pointing at the freed
native object. This is the path corrected in upstream WebKit
[commit 040ef6e](https://github.com/WebKit/WebKit/commit/040ef6e21ffac03b6d6098e0e12354bdb5469ad1).
The live console's slot alias and pixel write support the same mechanism;
the Sony source archive is an analogue, not a byte-for-byte 14.00 binary.

The source `CanvasRenderingContext::deref()` forwards to the context's canvas.
The live GC check establishes that the distinct stale wrapper was finalized
after the slot reused, while the new canvas/context still functioned under
explicit JS roots. A useful next discriminator is whether the target canvas
lifetime diverges from an ordinary context when the canvas wrapper is dropped
but its context wrapper is retained. A native trace or exact 14.00 binary
would make that accounting test much more precise.

The complete ignored evidence archive is
`evidence/2026-10-19-canvas-slot-reuse.zip`, SHA-256
`b49659ceb5d0f45de8654ee64b6d261dbaa9d861b65230600b2d30ff64476cd1`:
57 raw captures, 114 exact probe snapshots, and a consistent SQLite backup.
