# Per-page address calibration on PS4 14.00

Updated 2026-10-22. A refresh creates a new browser page and can change
both the forged History view's placement and nearby JavaScript objects.
Addresses and view indexes from an earlier page are never input to a new
page's native-call plan.

## Observed variation

The same JSArray-storage probe passed with a dynamic element index of
233,576 on page `fc314040` ([capture](../captures/bbfc9a13baf84879ba3b991cec327882.json))
and 155,752 on page `31b5aff8` ([capture](../captures/1b9bb2399c444d68850a17b1df706078.json)).
An earlier page `14df9489` found one live anchor in grooming batch two
and derived base `0x2016f0000` from its own object word and view index
([capture](../captures/8f653bdafc9542468584bfa09be50d99.json)).
That base is evidence for that page only.

On page `fc314040`, four bounded 8,192-object batches returned no
verified live anchor in the first 4 MiB (captures
[`ff6a7a4f`](../captures/ff6a7a4fb0164e2dac78550558eaa951.json),
[`54518583`](../captures/54518583b2b44add880b0e092e32706c.json),
[`313ad1f8`](../captures/313ad1f833c94470aec5927ab73f17ed.json),
[`711a7191`](../captures/711a7191faa343f6a6cd1baff5c03716.json)).
No native-call plan or NamedObj repeat ran on that page.

On page `31b5aff8`, two batches produced thousands of marker-shaped
words but none survived a reversible live-object mutation
([diagnostic](../captures/ffcf7b9ce6204237a920c68c140abc26.json)).
The first two batches and a later third batch were scanned again with
fresh temporary marker values, one 1 MiB region at a time. No live
marker was found in the bounded first 8 MiB; the final third-batch
[capture](../captures/86a991b4f17542cab1a4c786de1c2d9f.json)
reported zero live hits, intact JSArray restoration, and no address
calibration. The page stayed connected through the collector. The
operator's on-screen confirmation is recorded separately.

## Gate for later commands

[`clone_history_live_anchor_scan_v1`](../probes/clone_history_live_anchor_scan_v1.js)
uses page-local rooted objects and temporary marker changes. A candidate
must reflect a second marker change immediately, and two different
objects must yield the same base from their separately read JSArray
words and view positions. The downstream typed-cell and native-call
probes already require `state.addressAnchor` and
`state.calibratedViewBase`; neither is set when this gate fails. The
scan's 1 MiB chunk size and 8 MiB maximum are resource bounds, not
addresses or calibration constants. A future setup should place its
calibration object alongside an allocation already proved reachable by
the forged view, rather than rely on post-clone object grooming.

The first cloned-object setup v2 incorrectly required the History clone
to preserve alias identity between `first` and `second`. Its
[capture](../captures/a0d28676ae6f44d5a893d20ec07b716b.json)
passed the JSArray storage checks but failed that extra gate. The
corrected [v3 capture](../captures/3afe8dfd38bf47179dea4cbcb6ceef74.json)
measured `first_second_same:false`, two distinct objects with their
intended marker values, and a live JSArray element index of 65,640.
This is a per-page measurement, not an address carried forward.

The [cloned-object locator](../probes/clone_history_cloned_anchor_scan_v1.js)
temporarily changed both markers and searched eight successive 1 MiB
regions. Every command completed with the JSArray restored, but none
found either temporary marker in the first 8 MiB (first
[capture](../captures/7a94d87bbbc0450c82d28bf2109623bf.json),
last [capture](../captures/fe7cbd1dde024e86a4f4dcea53ed4702.json)).
One repeat of v3 on the same page again measured index 65,640
([capture](../captures/a311b9340db54c3ca345bbb1f1264405.json)),
so merely cloning again did not move this layout. No native-call plan
or 557/601 test ran on this page. This attempt suggests that the cloned
object cells are outside the forged view's tested forward range;
it does not give their absolute placement. The next setup needs a
different way to relate a *known, reachable* allocation to a live
pointer, rather than a wider blind scan.

At the operator's request, the established full preparation was then
attempted on this same page. The corrected History/JSArray setup had
already passed again ([capture](../captures/a311b9340db54c3ca345bbb1f1264405.json)).
Four bounded [`inrange_anchor_groom_v6`](../probes/clone_history_inrange_anchor_groom_v6.js)
batches, each adding 8,192 rooted objects and checking the first 4 MiB,
all failed to find a *live* anchor (captures
[`8cf01774`](../captures/8cf01774cb044b048c0f421311dd3f89.json),
[`98f30483`](../captures/98f30483c8e6473ba1aeed8bae3ed22c.json),
[`064d9849`](../captures/064d9849c95345ebbe21e816df6dafa0.json), and
[`955c05b4`](../captures/955c05b47d2840e0ac3d56e44616b64a.json)).
Batch two saw 7,530 marker-shaped candidates, but none responded to a
temporary live-object mutation. Every batch restored the JSArray slot.
All six setup/groom captures passed integrity verification. This page
has no `calibratedViewBase`, so the typed-cell, native-call, and syscall
stages were not dispatched. A pass on an earlier page cannot substitute
for this page-local address gate.

## Clean-page recovery

After a refresh, page `65f9f55c` used the established v1 History/JSArray
setup rather than the experimental cloned-object variant. The array slot
was measured at index 155,752 ([capture](../captures/87fe7fd8db984486b64c665aabc63234.json)).
The first 8,192-object grooming batch found a live marker at index
1,622,344 and independently derived this page's base `0x2013f0000`
([capture](../captures/49d953b823404aea8d24eb8ec56ea706.json)).
The typed-cell spray, owned typed-array pair, native call plan, independent
worker plan, and v27 guarded caller all passed in sequence on this same
page ([spray](../captures/61c9199ab6ab46318798ce8490773b9f.json),
[pair](../captures/98fcce511231411d9e48460e64c80d3c.json),
[plan](../captures/a0cf7663e82242ddaae7bbec23bae4ea.json),
[worker](../captures/8cadc9a1539a46c1ac0eb1d21d30b98c.json),
[caller](../captures/d909d285d5624bf1816801d292551da8.json)).
The caller checked mapped gadget and wrapper bytes, returned PID 62
through its benign control, and restored the carrier. The earlier failed
page remains a calibration failure; the recovery does not validate its
addresses retroactively.

## Wide-window recovery on a different 14.00 page

On 2026-10-22, the refreshed session `6780d62a` had a valid forged
History view but the original JSArray setup missed the fixed buffer in
three tries ([first](../captures/5fbe8c75c7174c19a93a9afba27f21e8.json),
[second](../captures/89218480714942c3961907d7d2270ac0.json),
[third](../captures/92310337726a45f4b44fcfb7967d5347.json)).
A 4 MiB window found a candidate but also unrelated changing heap
bytes, invalidating the original whole-window exact-change count
([diagnostic](../captures/1ad87851e360414abea53f52bef6b5a6.json)).
The next check found one contiguous 65,536-byte region that restored,
and adjacent array-slot changes exactly eight bytes apart, but again
recorded hundreds of unrelated changes elsewhere
([diagnostic](../captures/f1aee528e34d4b44a790e2a221be20f5.json)).
The [corrected setup](../probes/clone_history_jsarray_storage_v4.js)
independently toggled and restored each slot after locating the one
restored buffer region. It passed with `fixed_index=155640`,
`first_change=155752`, `second_change=155760`, and
`slot_toggle_ok=true`, despite unrelated heap-byte changes
([capture](../captures/525ac939d8874b028edaae2ce3389423.json)).

Anchor groom batch one had 48 marker-shaped candidates but no live
match ([capture](../captures/2f7f037aee8041bfb6771a6c5f9f0e5f.json));
batch two found a live marker at index 2,670,920 and derived the
page-local base ([capture](../captures/3b57df0712f949c6a3172360ad0ca65b.json)).
The old typed-cell preflight rejected that valid index solely because
it capped the anchor at 2 MiB
([capture](../captures/800043b09aaf4919838d8213bf905a31.json)).
The [updated 4 MiB preflight](../probes/clone_history_typed_cell_spray_v3.js)
passed ([capture](../captures/e3dea7b830f447c9ba47538175c904b5.json)).
The first owned-pair attempt found typed cells outside the view; one
bounded 8,192-cell growth batch moved two candidates inside it
([growth](../captures/af26b121436140358a2a217e15e9ba11.json)),
and the pair setup passed with reversible aliasing
([capture](../captures/65e01d1fffb84a6f9200824584ed6f3a.json)).
The native plan, worker plan, and byte-checked v27 caller then all
passed on this same page ([plan](../captures/119de988f8224eb3b753a9e4eb6e206b.json),
[worker](../captures/5a398cd2411f48b38531b5c006681941.json),
[caller](../captures/cb17b4bcdda24f3ebf7bce8bf4f388af.json)).
The targeted v28 caller additionally located and checked number-432
and number-481 wrappers ([capture](../captures/b3eca5082b2f4aaca20ba61e0779a3a4.json)).
All addresses in this paragraph were discovered on session `6780d62a`;
none are reuse constants for another page. The preparation helper now
falls back to the wide slot-toggle check when the original History
gate fails and accepts a live anchor anywhere within the groomed 4 MiB.

## Two remote reloads after the AIO concurrency sweep

On 2026-10-24, remote page reloads created sessions `7cfda39a` and
`5f62e498` in the still-running browser process. JSArray storage passed
on both pages, but each page's four 8,192-object grooming batches failed
to find a live marker in the first 4 MiB. The [first page's final
capture](../captures/527be7bd14c84c6ebaa6c2b7cf20be59.json) and
[second page's final capture](../captures/acba6aad9e8b482295158159ad390276.json)
show restored JSArray state; the collector continued to receive page
polls. No native-call or AIO test ran on either page. A browser-process
restart, rather than another in-process page reload, was the next clean
calibration attempt for the independent AIO repeat.

The operator closed and reopened the browser; new session `5839ba27`
passed [JSArray storage](../captures/5f86388d17db4d8692fd00e076254dc9.json).
Anchor batch one missed, but [batch two](../captures/e999e7fac13e48e3adf99575dceffa80.json)
found a live marker and measured this page's base. The typed-cell spray,
owned pair, native plan, worker plan, and [byte-checked v34 caller](../captures/6515eff419d145768639e4fbba6619e8.json)
then passed. The prepared AIO lifecycle probe ran on this page; its
results are in [the AIO record](AIO_14.md). No address from this session
is a reuse constant for another page.
