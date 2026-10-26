# Focused PS4 browser matrices, 2026-10-19

The operator's Settings-confirmed 14.00 browser remained connected while these
hash-pinned probes ran. They expand two existing leads and test specific
failure boundaries. No native memory primitive was observed.

## Unicode backreference matrix

The [WebKit 308046 fix](https://github.com/WebKit/WebKit/commit/2693828e8d73)
changes the YARR JIT's Unicode backreference offset when terms follow the
backreference. The earlier six-case probe passed. The new
`regexp_unicode_offset_matrix_v1` tried 96 combinations of four duplicated
characters (ASCII plus three non-BMP characters), three prefixes, four suffixes,
and `u`/`iu` flags. Each ran 600 times to cover warm execution.

Command `312f85b09e804dc9b3190eec49582f3a` saved
[capture `fbd074a3d3bf422bb951f26c3384c311`](../captures/fbd074a3d3bf422bb951f26c3384c311.json)
(SHA-256 `4008e84bf11beff85669927c542d970c3d823635f51f1d600cbc2dfe77f454bb`).
All 96 cases matched their expected capture and full match, including after
warmup. This does not establish the console's JIT configuration or rule out all
YARR bugs; it rules out those concrete inputs as a useful discriminator.

## Cloned view size and type

The previously reproduced BigInt pool shift attaches a typed-array view to the
wrong cloned `ArrayBuffer` when both buffers are large enough. The size matrix
kept the original view at offset 4 with eight bytes in a 16-byte source buffer,
then varied the mistaken backing buffer's length. `clone_view_size_matrix_v2`
command `d3443e38628d4ae781cb8310a85d3276` saved
[capture `4970f59df2604f8eb5324ab532a424a7`](../captures/4970f59df2604f8eb5324ab532a424a7.json)
(SHA-256 `a3acee94de3de35a3becbd133f3d01a43da90063eb433db8f6562b3b393490ba`).
Number-prefix controls passed. With a BigInt prefix and mistaken buffer lengths
0, 1, 8, and 11, the cloned slot was **not a view**. At lengths 12, 16, and 32,
it was a view of the wrong buffer, with a reported byte range within that
buffer. In particular, the exact-fit length was 12 for offset 4 plus length 8.

`clone_view_type_matrix_v1` repeated the one-byte-short case with Uint8Array,
Uint16Array, Int32Array, Float64Array, and DataView, each with a matching
number-prefix control. Command `ba36dd59600c440b9ee956715486f519` saved
[capture `69bdd15e581c479c95beeedf506d9b3f`](../captures/69bdd15e581c479c95beeedf506d9b3f.json)
(SHA-256 `6bad75a9e720b228ef12557c1926a90c0507f211df572b40c5633e588b9e117f`).
All five controls passed; all five BigInt cases returned a cloned slot that
was not a view. No case produced a view reporting a range beyond its backing
buffer. These observations support the pre-fix WebKit source's view-construction
bounds check as an explanation, but the running PS4 binary remains unidentified.

The first size-matrix attempt, command `98d696e80b5a470c804ab2d6e5035c47`,
saved [capture `87b5ee4679bc45858991dd8e2d4537dd`](../captures/87b5ee4679bc45858991dd8e2d4537dd.json)
with a `probe_error`. Its source tried nine synchronous markers, exceeding the
collector's eight-marker limit. It is a harness error and contains no clone
result. The corrected v2 source and all earlier snapshots remain hash-pinned
in the local control store.

All three successful captures passed `python -m fw14lab.verify`. These tests do
not prove that other clone graph shapes, view types, or deserialization paths
cannot yield a native effect. They do narrow the direct size-mismatch route.

The ignored snapshot `evidence/2026-10-19-focused-matrices.zip` holds the 31
then-current captures, 64 exact probe snapshots, and a consistent SQLite copy.
Its SHA-256 is
`0f0d23b6f8655d0d51743935d06445d77e18c877dd79c616084ec4844ef35478`.
