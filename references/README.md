# Public source references

These files are research inputs, not copies from the older project. Extracted C++ files are ignored by Git; this index records their origin and hashes. On 2026-10-19, [Sony's PS4 WebKit source page](https://www.playstation.com/en-us/oss/ps4/webkit/) listed an open-ended **“For PlayStation 4 system software version 13.00 -”** archive and no separate 14.00 entry. The listing may cover 14.00, but it does not attest that a specific file matches the console's running browser binary. Continue to treat source-level object layouts and allocator behavior as hypotheses until matched against live 14.00 measurements.

| Local ignored file | Public origin | SHA-256 |
| --- | --- | --- |
| `upstream-webkit/SerializedScriptValue-sony-616-1300.cpp` | [Sony PS4 WebKit archive](https://www.playstation.com/en-us/oss/ps4/webkit/), member `WebKit-616-1300/Source/WebCore/bindings/js/SerializedScriptValue.cpp` | `00dc88644d8c2d4a05ff0dca0cb1cff03af909faf3c24dab1b7fed985439fc90` |
| `upstream-webkit/TransformStream-sony-616-1300.cpp` | Same archive, member `WebKit-616-1300/Source/WebCore/Modules/streams/TransformStream.cpp` | `0fbdf7c4a3c0f1bbb19ccdf737f5d3746ec3b79f2adfe53772d23fd1ee33b807` |
| `upstream-webkit/JSDOMConvertSequences-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/WebCore/bindings/js/JSDOMConvertSequences.h` | `14cd64a367d917475ceefba4a6fbabb3140ea82796c010bf1dcdc638964da867` |
| `upstream-webkit/Vector-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/WTF/wtf/Vector.h` | `5995bf85272e4016c75a3973ad600fb499349a57687cc0d8656a0ef10319678f` |
| `upstream-webkit/Forward-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/WTF/wtf/Forward.h` | `f7ef0b58bed11d2c025cbd6598f434192e6e824c156fa406000826c3986d4376` |
| `upstream-webkit/CheckedArithmetic-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/WTF/wtf/CheckedArithmetic.h` | `c3ad06c04f5553ad15bfff6ecfd0bf60c90ba1fd447f9a46e9c3801661d70b0e` |
| `upstream-webkit/JSCast-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/JavaScriptCore/runtime/JSCast.h` | `ac9245f52a8c3f2c23eb3662184f9e074b3fe57df466a04ce250bb4273bfaeb2` |
| `upstream-webkit/FontPlatformDataFreeType-sony-616-1300.cpp` | Same archive, member `WebKit-616-1300/Source/WebCore/platform/graphics/freetype/FontPlatformDataFreeType.cpp` | `5806d7d3018e78d1733a9940e2896320ed8d9906018fca539f3af531e1911f4d` |
| `upstream-webkit/JSDOMConvertObject-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/WebCore/bindings/js/JSDOMConvertObject.h` | `ede16ed846b5f17ac624f511bc7ef13d5b4491fc99609ed0ee135addfcb7396a` |
| `upstream-webkit/IteratorOperations-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/JavaScriptCore/runtime/IteratorOperations.h` | `7af52fa4f4fee3c93f0ebcc0aede6fd86b72b1920f1ca761ea2d3c5bb6e38b17` |
| `upstream-webkit/JSDOMConvertBase-sony-616-1300.h` | Same archive, member `WebKit-616-1300/Source/WebCore/bindings/js/JSDOMConvertBase.h` | `5880ecfc21964fbeae44ea68348640ed48a596ae3c54a98fa22fce09582a4859` |
| `upstream-webkit/SerializedScriptValue-7841b279.cpp` | [WebKit source at commit 7841b279](https://github.com/WebKit/WebKit/blob/7841b2790f42d00eb2a8a9357a38d9df5509e047/Source/WebCore/bindings/js/SerializedScriptValue.cpp) | `1f83c18a695b2a0775bcaa92d4c700a77e429cad744495534ad41530d4a22ebe` |

The Sony ZIP URL used for the bounded range extraction was `https://www.playstation.com/content/dam/global_pdc/en-us/external-resources/oss/ps4/webkit/WebKit-616-1300.zip` (the page's B archive). The helper is `tools/remote_zip_member.py`; it extracted only the named members. The page's A archive, `WebKit-601-1300.zip`, was separately inventoried by member name on 2026-10-18. Its 829,119,263-byte ZIP had no member containing `TransformStream`; it did contain `ReadableStream` files. This narrows the relevant public-source branch for the live `TransformStream` API, but neither archive is a measured copy of the console's running binary.

The newer font-loading investigation has its three extracted source members and hashes in [font-face source provenance](FONT_FACE_SOURCE.md).

The canvas context investigation has its extracted `HTMLCanvasElement.cpp` hash,
upstream fix, and advisory links in [canvas source provenance](CANVAS_SOURCE.md).

A read-only inventory of `old-webkit-project` on 2026-10-19 found no decrypted PS4 WebKit module (`.sprx`, `.self`, or `.elf`). Its PUP inspection note (local prior-work archive: `old-webkit-project/analysis-20261001/pup/PUP_INSPECTION.md`, not included here) describes protected inner PUP containers and does not establish that the update file is firmware 14.00. That material cannot identify this console's running browser build or supply 14.00 code offsets. No old file was modified or imported.
