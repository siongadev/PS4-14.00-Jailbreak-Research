# Structured-clone reference substitution in the reported 14.00 browser

**Status:** Browser-visible integrity failure reproduced across separate probes and repeated within one live session. The page was opened on the user's PS4, the operator entered firmware label `14.00`, and the browser user agent reported `PlayStation 4/14.00`. The operator later checked **Settings → System → System Information** and reported 14.00, supporting the `observed-14.00` label under [our evidence rules](EVIDENCE_RULES.md). A browser binary fingerprint has not been recorded. The repeats do not establish behavior on another device or browser build.

## Minimal reproduction

```js
const filler = { marker: "filler" };
const target = { marker: "target" };
const copy = structuredClone([BigInt(23), filler, target, target]);
copy[2] === copy[3]; // expected true; observed false
copy[1] === copy[3]; // expected false; observed true
```

The cloned repeated reference points to the cloned filler rather than the cloned target. Replacing `BigInt(23)` with the number `23` makes the two assertions behave as expected. The live [object-substitution capture](../captures/e771d9a5cfdb46048b91826ca75ce96c.json) has submission SHA-256 `b4126cfe3c57d366b0892315c45f9a28482e8ec4137c026109f97ffb58dc20a8`; its source digest is `cdd1cbda27de605e8ccf0a7c676ad6b0f47ca667adeb81fa5aa54dccee003cdb` and manifest digest is `6b9e60d29186fd33b28528726c21ccc477b6cbb89e9132acec9f8684c3f251d2`.

An earlier, separate [minimal capture](../captures/b05e1b55c1c248bb9ba55f6f56ffb9ec.json) showed `[BigInt(17), shared, shared]` cloning with `BigInt(17)` in place of the second object reference. Moving the BigInt after or between the two object references preserved identity. The exact first probe was run twice, yielding [capture one](../captures/03ba8fd762bf44d3b2cda7fcd3b86ff8.json) and [capture two](../captures/9c5faf002f8648b08d593390ba8c5f00.json) with identical per-check outcomes. The [reference-shift capture](../captures/e46cf68c590a47f0a29c990b448c71e9.json) showed the wrong reference's marker tracking an earlier filler as more fillers were added; the direct filler identity comparison is in the object-substitution capture above. `MessageChannel` delivery also showed a failed alias when a BigInt preceded the repeated object. All corresponding probes passed their desktop Node controls; Node is an ordinary-behavior comparison, not a PS4 implementation model.

## Cloned typed-array view attached to the wrong buffer

Two 8-byte buffers were filled with different bytes: `0x11` in the first and `0x22` in the second. A three-byte `Uint8Array` view was created on the second buffer at offset 2, then `[BigInt(23), first, second, view]` was cloned. In the [first capture](../captures/314e9a6bd5924fe295039c7437a33426.json), the cloned view's `.buffer` was the **first** cloned buffer and its first byte read `0x11`. Writing `0x7f` through that view changed byte 2 of the first cloned buffer; byte 2 of the second stayed `0x22`. The number-prefix control attached its view to the second buffer and wrote there as expected. An [exact repeat](../captures/0a18b34c1e254c348e947a55ec2aa1d4.json) produced the same statuses and byte values. The first capture's submission SHA-256 is `cd51b20f1d3dd6dfab13f65627d9c5de71248bfef027966645141b511a4b2ec9`; probe source SHA-256 is `3313712ae978b88662697ccc061995ea88acbc72dc0f7fe04cd10bd91b107476`.

This is a writable data mix-up **within valid cloned ArrayBuffers**. The small probe does not write outside either 8-byte buffer. The relevant [pre-fix WebKit deserializer](https://github.com/WebKit/WebKit/blob/7841b2790f42d00eb2a8a9357a38d9df5509e047/Source/WebCore/bindings/js/SerializedScriptValue.cpp#L3281-L3333) checks that a view's selected value is an ArrayBuffer, and the [typed-array constructor](https://github.com/WebKit/WebKit/blob/7841b2790f42d00eb2a8a9357a38d9df5509e047/Source/JavaScriptCore/runtime/GenericTypedArrayViewInlines.h#L107-L126) checks its offset and length. This upstream source helps interpret the bounded result but does not establish the exact code in the console.

The [HTML structured-clone algorithm](https://html.spec.whatwg.org/multipage/structured-data.html) specifies preservation of shared references in the cloned graph. A [WebKit change from January 2024](https://github.com/WebKit/WebKit/commit/010c6bdfb0cde0485d31f0260ab9a046fa9b8567.patch) documents a serializer/deserializer object-pool mismatch involving BigInt, Map, and Set. Our result is consistent with that mechanism. The source change alone cannot identify the console's WebKit revision, and the ordinary Map/Set prefix cases we tested passed; the failure is not established for all graph shapes or all cloning APIs.

## Impact and next evidence

This is an actual wrong-value/identity result observable in JavaScript and a useful browser-side research lead. An application that relies on cloned graph identity or buffer association could receive or modify the wrong cloned object. These tests do **not** show an out-of-bounds access, native type confusion, arbitrary native read/write, sandbox escape, or kernel access. In the analogous pre-fix upstream code, an ordinary positive out-of-range [pool lookup returns JavaScript `undefined`](https://github.com/WebKit/WebKit/blob/7841b2790f42d00eb2a8a9357a38d9df5509e047/Source/JavaScriptCore/runtime/ArgList.h#L139-L149), not an arbitrary memory read. The operator has since confirmed 14.00 in System Information; the captured user agent and entered version agree, but the binary revision is still unknown.

The exact test sources, manifests, and all capture digests are indexed in [the observation log](OBSERVATIONS.md). Raw captures and source snapshots are local evidence; they are Git-ignored to keep the repository free of console-specific session data.
