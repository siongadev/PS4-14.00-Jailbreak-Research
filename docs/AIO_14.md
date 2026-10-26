# AIO operations on retail PS4 14.00

The running WebProcess's hash-checked `libkernel_web.sprx` has fixed-number
wrappers for 661–677. Its own callers of wrapper 669 pass commands `1`,
`2`, `0x1001`, and `0x1002`. That gives a 14.00 basis for testing the
historical `aio_submit_cmd` interface. [Public historical syscall
table](https://www.psdevwiki.com/ps4/Syscalls) and [older public AIO
request structure](https://github.com/rezaadi0105/PSFree/blob/main/lapse.mjs)
guide the names and layout, but are not evidence that an older exploit
works on 14.00.

The byte-checked v51 caller was installed on the live 14.00 page in
[capture 4acd30ee](../captures/4acd30eeaf0349e691b3b7ada05e2db4.json).
The fixed-number wrapper census found all nine entries 669–677, and
the native `getpid` control passed. Addresses and IDs below belonged to
that single page and must be recalibrated after refresh.

| 14.00 probe | Direct observation |
|---|---|
| [Tail read screen](../captures/27572d23adea407582e5afecfd2a3d79.json) and [zero screen](../captures/4267c2d531764755b0e8992784a39de9.json) | 671, 672, 677 returned `EPERM` in two basic shapes; 674 returned `EINVAL`; 670 returned 0 with zero arguments. No read output or privilege effect. |
| [Zero-count 669 gate](../captures/8d697fd4ad6f4f2092900dcfe73e6ccf.json) | Commands `1`, `2`, `0x1001`, `0x1002` with zero requests returned `EINVAL`, including an owned-buffer variant. |
| [One-request read](../captures/0244882b5b744e35a5302b127e6093b0.json) | A 40-byte request reading one byte from an owned `/dev/random` descriptor submitted successfully; returned ID 103, state 3, one byte, deletion success, and clean descriptor close. |
| [Two-request read](../captures/d88cb5a1ae9c4fe49490a950706b01ff.json) | Command `0x1001` produced two IDs and both completed with one byte. The early probe recorded syscall-level deletion success, not separate per-ID deletion results; the descriptor closed and guards stayed intact. |
| [Sequential duplicate delete](../captures/340ea5f1ff2840d49799075a1b355387.json) | First ID deletion succeeded; repeating it returned syscall 0 with per-ID `0x80020003` (no matching request). The sibling poll returned `0x10003`, completed state 3 plus notification bit `0x10000`. The probe misread this as unfinished and left the sibling live. This was a probe predicate error, not a kernel failure. |
| [Targeted cleanup](../captures/302e4d68060d41f29a2fa49390cb9fc3.json) | Same page/PID and frame IDs were checked. Masking off `0x10000` recognized completed state 3; sibling delete and descriptor close returned 0. The earlier probe's saved frame bytes were unavailable, so scratch contents were left in place. |
| Pending socket read plus misidentified syscall | The [retired probe](../probes/clone_history_aio669_socket_pending_cancel_v1.js) reached `aio_socket_submit_before` then `aio_socket_cancel_before` on command `1` using an owned socketpair. It sent no after-call marker or result. The user saw the unresponsive-page prompt, then the entire console ignored the PS button and required reboot. **The probe called 663, which is `aio_multi_wait`, with a null timeout on an unreadable socket.** The source label said “cancel” in error. This is consistent with an unbounded wait and does not establish a kernel bug. |
| [Completed-request 666 cancel-shaped control](../captures/407e58ee9c334e4a97b7f2b4bed6bdf0.json) | Fresh page PID 63: one-byte `/dev/random` read reached state 3; 666 returned 0 with state 3; delete returned 0/per-ID 0; descriptor and frame restored. |
| [Pending socket read without cancel](../captures/ec725a49a80e4db68d0c4e855f01f056.json) | Fresh page: socket read started in state 2. Peer write returned one byte; poll then reported state 3 and result one byte. Delete and cleanup passed. |
| [Pending socket read with 666 cancel-shaped call](../captures/f0700425f2704ab399d0f9419a433bdf.json) | Fresh page: 666 returned 0 while the request remained in state 2. Peer write then completed the read (state 3); delete and cleanup passed. No stale ID or premature deletion was observed. |
| [Pending socket read with finite 663 wait](../captures/6f047033a6a24dc497ed8c1cca184109.json) | Fresh page: an owned 10,000-usec timeout returned `-1/ETIMEDOUT` (errno 60) while the read was pending. The peer write then completed it; delete and cleanup passed. This supports the prior null-timeout call being an unbounded wait. |
| [Delete during processing](../captures/d7e4c6dae569489f83961445f86f1d5f.json) | Fresh page: state 2 deletion returned syscall 0 but per-ID `0x80020010` (`EBUSY`). After peer write completed the read, deletion returned 0/per-ID 0. |
| [Cancel-shaped call, then delete during processing](../captures/fd6981c363c94ee9a67914abf8235527.json) | 666 returned 0/state 2. Immediate deletion again returned per-ID `0x80020010`; completion and final deletion succeeded. No premature delete or stale-ID effect in this sequential path. |
| [Duplicate ID in one delete batch](../captures/6a48a0d0c9234758b0e8cc38e343f068.json) | On the fresh PID-63 page, a completed request ID was passed twice in the same 662 deletion batch. The call returned 0; its first per-ID result was 0 and the second was `0x80020003` (`ESRCH`). The owned descriptor and frame were cleaned. This batch shape did not double-delete the request. |

The pending-read probe's [manifest](../probes/clone_history_aio669_socket_pending_cancel_v1.json)
and source are preserved only to audit what ran; **do not rerun them**.
The corrected numbering is corroborated by the [public syscall
table](https://www.psdevwiki.com/ps4/Syscalls) and the 14.00
`libkernel_web` callsites: direct callers at RX `+0xc310` and `+0x16ea0`
call the 663 wrapper at `+0x2c3d0` with five arguments including wait
mode and timeout pointer; a caller at `+0x151d0` calls the 666 wrapper
at `+0x2d530` with ID pointer, count, and output pointer. The source RX
hash is `63b0e22e855625c3322aab67af54e015baf995b8acf11b6fa4174bde6f1c96e2`.
The completed-request 666, pending socket no-cancel, pending 666,
finite 663 wait, and processing-delete controls have all passed on the
rebooted page. They measure a cancel-shaped call returning `0`, a finite
wait, and busy guards. The processing read still completed after its peer
write, so the `666` result is not evidence that cancellation took effect.
They do not show the older AIO double-free or a new 14.00 race.
Without a distinct 14.00 anomaly, sequential variations of this same
state transition are now lower priority than a different kernel or
broker boundary.

The negative sequential duplicate-delete result is not a race audit.
No arbitrary kernel read/write, process credential change, sandbox escape,
or kernel execution has been observed from this AIO branch.

On 2026-10-24, the [combined fd-reuse test](CHAIN_COMPOSITION_14.md)
kept an in-flight read tied to its original socket despite reuse of the
numeric descriptor. A 64-request completion/delete batch and an
eight-group, 128-request delay sweep returned per-ID `EBUSY` on every
immediate delete, followed by normal completion and cleanup. These are
serial schedules; a true concurrent race remains untested.

The [PS4 vulnerability inventory](https://www.psdevwiki.com/ps4/Vulnerabilities)
places an older AIO double-free bug through PS4 12.02. This historical
range does not establish that the same bug exists on 14.00. The current
14.00 measurements below need their own repeatable state or memory effect
before they can support a kernel read/write claim.

## Concurrent deletion on 14.00 (2026-10-24)

The browser now has independently prepared page and worker native-call plans.
Each run submits completed, owned socket reads, wakes the worker through a
user event, and calls the byte-checked 662 wrapper from both threads with
the same target ID and **separate** per-ID output buffers. Every completed
capture below reports restored worker pointers, intact output guards, and
descriptor/request cleanup. The early [v1 capture](../captures/1a9e9426efdc4e49b18adde2c1eca081.json)
lost its detailed result to the collector's field-count limit; [v2](../captures/e01838618a7a4070a3b122de47dae189.json)
showed that a two-entry call batch was rejected by the caller before the
page-side trigger. Neither is kernel evidence. The
[capture index](AIO_CONCURRENT_RUNS_14.json) lists every run, its hash,
per-ID results, and cleanup status.

| Request shape and schedule | Observed result |
|---|---|
| [One request, immediate page batch](../captures/fccd86fa89274ede85f502526838b1a7.json), [repeat](../captures/cf92d59fbc894fd5a8960251bd6e8451.json) | Page deletion accepted; worker got per-ID `0x80020003` (`ESRCH`). |
| [One request, four benign calls before page delete](../captures/36243c5962584b959208b43c33a77c8e.json) | Same page-first result. |
| [One request, separate page calls](../captures/4ffacd1df3a54fb79148c6dd1b908735.json) and [10 µs native pause](../captures/8845a089466445fdbf9c3841748bc393.json) | Worker deletion accepted; page got `ESRCH`. Both are ordering controls. |
| [One request, zero-length native pause](../captures/ea3dbe07611a4e79904bb0bd27ac922b.json) | **One** verified capture had syscall return 0 and per-ID result 0 on **both** threads. The exact [repeat](../captures/981ec4cf9a7a4201964019884357db92.json) and [five more attempts](../captures/ae3a2b5e30504b0fa5acaf96205a90c8.json) returned one accepted deletion. This is an intermittent dual-acceptance output, not proof of two frees or a kernel read/write primitive. |
| [One request, 1 µs pause](../captures/80fdf70f95614aaca841930fcdee60f6.json) | Worker accepted; page got `ESRCH`. |
| [Two requests in one MULTI object](../captures/3b441b5508fb473386048ce4e420a594.json) plus ten further attempts | All eleven returned one accepted deletion; the sibling remained in completed state `0x10003` and was deleted normally. |
| [Three requests in one MULTI object](../captures/2fd58ec1b74241888ca71d646ed6f63a.json) plus ten further attempts | All eleven returned one accepted deletion; both siblings remained in completed state `0x10003` and were deleted normally. |
| [Three requests, 1 ns native pause](../captures/a5750c898a9649378017ab3cb816efd0.json) plus ten further attempts | All eleven returned one accepted deletion with the **worker** winning; both siblings again stayed in completed state `0x10003` and were deleted normally. |

The historical double-free branch requires `ao_rem_ids != 1`; its
[public implementation](https://github.com/rezaadi0105/PSFree/blob/main/lapse.mjs)
submits three requests and races deletion of the last ID. Therefore the
single-request dual-acceptance capture does **not** validate that historical
double free. The matching two-request and both three-request schedules have produced no
dual acceptance, surviving request after cleanup, changed guard, memory
warning, or privilege effect. The independent reopened-browser
repeat and request-lifecycle check below did not reproduce the lone
single-request anomaly. No sandbox escape or kernel read/write has been
demonstrated by this branch.

Two remotely refreshed pages after the sweep passed JSArray storage setup
but found no verified live address anchor in four bounded grooming batches
each. They remained responsive; no native caller or AIO command ran on
either page. After the operator closed and reopened the browser, session
`5839ba27e08d49e9bff06e1f951ec718` passed the full page-local setup
(the live anchor appeared in grooming batch 2). The
[single-request lifecycle probe](../probes/clone_history_aio_dual_delete_v12.json)
then completed [one run](../captures/49ad8751bbac49f5b89e05f49d9ccd64.json)
and twenty same-page repeats in that one reopened WebProcess, all hash-verified in the
[capture index](AIO_CONCURRENT_RUNS_14.json). Every run reported one
accepted deletion and one per-ID `ESRCH`; the subsequent 666 cancel-shaped call
returned syscall 0 with per-ID `0x80020003` (`ESRCH`). The output guards
and cleanup passed. The earlier single-request dual-acceptance output
has therefore not recurred in one initial run plus twenty same-page
repeats. This is not twenty-one independent fresh-browser samples. A
post-delete `ESRCH` is expected even after an ordinary
successful deletion and does not, by itself, distinguish whether the
earlier dual-success output represented two internal frees.

## Generic handle deletion cross-check

The candidate generic syscall-558 call shape uses an AIO ID and kind
`0x160`. On this PS4 14.00 page, a
[completed owned read](../captures/6f328e40763e41bf96ff6e67e1d01684.json)
and a [pending owned socket read](../captures/7b4bf016b47349d19ede876b9f56476b.json)
each returned `-1/ESRCH` from 558 with the actual AIO ID and kind
`0x160`. The absent-ID controls also returned `ESRCH`. The completed
request and the pending request both deleted normally through 662;
the pending read first completed with its expected one-byte result.
Both captures have intact output guards and cleanup, and the collector
continued to receive this page. There is no positive `558` control for
kind `0x160`, and no evidence that a `669` AIO ID belongs to the object
family accepted by historical `namedobj_delete` contracts. These results
therefore rule out only the exact `558(id, 0x160, 0, 0, 0, 0)` shape on
the two tested AIO states. They do not establish or refute a generic AIO
handle-deletion mechanism, measure the brief interval inside submission,
or identify another accepted object kind.

The v7/v12 source hashes in the capture index identify the packed scripts
served to the page. The readable probe files are preserved separately and
therefore have different file hashes.
