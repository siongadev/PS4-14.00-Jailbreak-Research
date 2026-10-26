# KTLS receive-path prerequisite on PS4 14.00

The [FreeBSD-SA-26:26.ktls advisory](https://raw.githubusercontent.com/freebsd/freebsd-doc/main/website/static/security/advisories/FreeBSD-SA-26:26.ktls.asc) requires a connection using software KTLS receive. This is an upstream source hypothesis, not evidence that Sony's 14.00 kernel includes the implementation or flaw.

On the calibrated 14.00 browser page, a read-only `sysctl` name-to-OID lookup for `kern.osrelease` returned success as a control. The same call for the advisory's `kern.ipc.tls.enable` facility returned `-1/ENOENT`; no KTLS value read or socket manipulation followed. The owned input/output region, guards, and caller state restored. [Verified capture](../captures/074aa27dc8ff4cbeb329717be417d032.json).

The named KTLS facility is absent from this browser's measured `sysctl` view. That fails the prerequisite gate for this specific upstream receive-path candidate. A hidden or differently named Sony implementation is not ruled out, but no 14.00 device evidence supports spending more tests on this advisory.
