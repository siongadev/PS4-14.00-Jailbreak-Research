# Font-face source provenance

Both files below came from the public Sony [PS4 WebKit page](https://www.playstation.com/en-us/oss/ps4/webkit/) archive labeled **“For PlayStation 4 system software version 13.00 -”**, ZIP `WebKit-616-1300.zip`, through the bounded `tools/remote_zip_member.py` range extractor on 2026-10-19. They are ignored local inputs, not checked-in source and not a binary match for the observed 14.00 console.

| Ignored local file | Exact ZIP member | SHA-256 |
| --- | --- | --- |
| `upstream-webkit/Sony-616-1300-CSSFontFace.cpp` | `WebKit-616-1300/Source/WebCore/css/CSSFontFace.cpp` | `047110c865310422c0ef77c05268841b1ac982bc22120e8c8e265539c713f3ab` |
| `upstream-webkit/Sony-616-1300-FontFace.cpp` | `WebKit-616-1300/Source/WebCore/css/FontFace.cpp` | `82b68a296b73840857f0947ae533748d86a8f52248d03cd3f4f06176e56ed50a` |
| `upstream-webkit/Sony-616-1300-CSSFontFaceSet.cpp` | `WebKit-616-1300/Source/WebCore/css/CSSFontFaceSet.cpp` | `bf331ac6fcfca559398b428b3aaec763ca7088c9b1d70361d3b6a7b6289d4ccd` |

Relevant upstream primary sources: [WebKit commit 5aedb82710ba578f61501106e78f6b25b7f7a558](https://github.com/WebKit/WebKit/commit/5aedb82710ba578f61501106e78f6b25b7f7a558), with its 17-line regression test and `iterateClients` change, and the [GLib backport note](https://github.com/WebKit/WebKit/commit/f1fff08a99d77bac49c2500ece3fdcfac06c8f1c) distinguishing the smart-pointer memory-safety fix from the later assertion fix.
