# 14.00 browser process boundary and record flags

Updated 2026-10-20. This note uses only fresh captures from the retail console reporting firmware 14.00. The source layout below is an interpretation aid; Sony's running kernel image is unavailable, so source identity is not claimed.

The live page's byte-checked [number-202 caller](../captures/ae814c4fa3264c8e8394951e76b6cd6a.json) passed 13 wrapper checks and four benign process-ID calls before querying process information. A size-only `{1,14,1,pid}` query returned a 1,096-byte record for its own PID `145`; the same call returned `EPERM` for parent PID `38` and `ESRCH` for a nonexistent PID. [First capture](../captures/229901e616f54d58aaa9ed14da3a0297.json), [exact-source repeat](../captures/437a5a86fee242baad0e82ebce7d9b47.json). Input MIBs, output guards, the forged-view carrier, and native call state restored. No signal was delivered and no other process was read.

An owned 1,096-byte output then read only PID `145` twice. The kernel's returned length and the first `ki_structsize` word were both `1096`; the process-ID word at offset `72` matched `145`. [First raw record](../captures/75424e7178994d7495dabe1d9347a845.json), [exact-source repeat](../captures/6134f92bc85a4541bda29dbf27a42d41.json). Both passed the output guard and restoration checks. The [offline decoder](../tools/decode_kinfo_proc9.py) applies the [FreeBSD 9 amd64 `kinfo_proc` field order](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/user.h), with [machine type widths](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/x86/include/_types.h), to those immutable bytes. Several independent fields align:

| Field in this source-derived layout | Observed value in both 14.00 captures |
| --- | --- |
| `ki_structsize`, PID, parent PID | `1096`, `145`, `38` |
| Effective, real, saved UID | `1`, `1`, `1` |
| Process name, thread count | `SceNKWebProcess`, `9` |
| `ki_cr_flags` at offset `588` | `0` (upstream capability-mode bit clear) |
| `ki_flag` at offset `368` | `268451969` (`0x10004081`; upstream `P_JAILED` bit clear) |
| `ki_jid` at offset `592` | `0` |

The [upstream `KI_CRF_CAPABILITY_MODE` bit](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/user.h), [upstream `P_JAILED` bit](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/sys/proc.h), and [upstream record-filling code](https://raw.githubusercontent.com/freebsd/freebsd-src/stable/9/sys/kern/kern_proc.c) explain those interpretations. In that upstream code, `ki_jid` may be deliberately **zero for a process queried from its own jail**, so `ki_jid=0` alone cannot rule out a jail. The absent `P_JAILED` bit and absent capability-mode bit are stronger observations under the matching layout. Sony could change either bit's meaning or record-filling logic despite retaining the field positions. The separately byte-checked Sony number-585 call returned `1`, and its older SDK label is `is_in_sandbox`; the precise 14.00 kernel policy behind that return is not inspected. [Current 14.00 sandbox-state capture](../captures/cf640b5c4d4b40559b8c4323cbfbebdd.json).

**Decision:** treat standard FreeBSD jail and Capsicum advisories as low-priority hypotheses unless a 14.00-specific prerequisite is independently shown. The current process is confined in observable ways—`setuid(0)` and parent-process inspection return `EPERM`, and parent-directed signal-zero checks return `EPERM`—but the record does not identify the enforcement code or show an escape. Focus the next candidate search on a Sony-specific interface or a generally reachable kernel bug with a distinct 14.00 authority oracle. Revalidate the layout on a new browser page before making a definitive statement about Sony's flag semantics.
