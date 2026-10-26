# Historical 14.00 second-object write records

This index covers every `old-webkit-project/ps4-research-captures/*.jsonl` file found with an `owned-marker-object-write` proof event. Each listed event carries firmware label `14.00` and reports `preflightMatched`, `writeObservedViaJS`, `writeObservedViaMemory`, `originalValueRestored`, `originalBytesRestored`, and `originalViewRestored` as `true`, with `error: null`. The label was observer supplied; the exact capture-time page source was not pinned. These are **14 matching proof records**, not a success rate across all attempted runs.

| Run ID | Local date | Raw JSONL SHA-256 |
| --- | --- | --- |
| `muoofnk0-41ikmvdm` | 2026-09-30 | `48373bb3fa19133152f4fbd25ee937552a64c2b68357972ae5423dd2e1ed6472` |
| `muop3ctf-jy6huzoq` | 2026-09-30 | `bac4dcccd11f79a77e0e6c852025a271e2ee083881f2192ec56ad777e69db8ba` |
| `muopb656-n2ipg5f7` | 2026-09-30 | `f6c05b5ed627076750f2714ee2371170a925bae73749c84d445e699493c0f3e6` |
| `muopxp5b-3pbv05uh` | 2026-09-30 | `f0a55e917ad3bdfb11d20abe70abf5faf02e70abc63090910b52e38dfed8ab42` |
| `muouo89q-dqin6d0e` | 2026-09-30 | `431f67e36f935ca819e6bd303555a8f48505abf620d8070c852a1216093f238d` |
| `muoupxss-j505ygl9` | 2026-09-30 | `ab54b5224a1a96c9284931f506bbea4142a17aa5f56856628862d773f6c6ecc0` |
| `muov2kny-zqrfu0je` | 2026-09-30 | `4d53563836c49f4688dd8ca4d0f692056f9b5a56f301226cd3e7d71af12b5078` |
| `muovc34e-p4jzzcbb` | 2026-09-30 | `62f46c2fd5b91e75a9f92cea7861847eb3fe3ef9c142e377dbd794607d7e63c7` |
| `muovug0f-vjqp0xo0` | 2026-09-30 | `57791a90808c9582ade489f4f91e7fc312969885a93f94d2769c693092be94c8` |
| `muow0kpd-eiqrzwpt` | 2026-09-30 | `4784676c1655169bc0476a3319e42e07d7c171053bf6b6f5013dac6c91c55714` |
| `muowg8gb-0h7f1uhy` | 2026-09-30 | `5f33eb2fcc29c5a30e04f64acee8ccc2fd21a563a086101aa8bf57154373b102` |
| `mv937x2e-zomfozop` | 2026-10-15 | `934d291cf0c01233cfa2d7e9dd463e43dcd55421f917e51f2a4526e1aa1ba7a0` |
| `mv9aqfyu-tiiw76m2` | 2026-10-15 | `af8c92290370e19c184fecf0c3ec4eba1d48f5a6272b729e65dda2efb4ceb66a` |
| `mv9c6ikh-of2kdugn` | 2026-10-15 | `f842ee378968b2579a3ff2f6b13f117b1a151436e681755a04c9af8404ae496b` |

The owned-marker event is stronger than the owned-buffer write because it targets a distinct page-owned JavaScript object and checks the effect through two independent paths. It remains historical evidence: a new-project claim needs the exact source and manifest hashes recorded by the current collector, a fresh 14.00 run, and restoration checks.
