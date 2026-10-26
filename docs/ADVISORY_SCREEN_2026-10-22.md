# New upstream kernel-advisory screen against the 14.00 browser

This is a **reachability screen**, not a claim that the PS4 14.00
kernel contains any upstream bug. The running Sony kernel image has not
been inspected. A FreeBSD advisory only supplies a source hypothesis;
device-specific reachability and a distinct 14.00 outcome must come first.

| Upstream issue | Required branch | 14.00 evidence gate | Decision |
| --- | --- | --- | --- |
| [SA-26:57.unix](https://lists.freebsd.org/archives/freebsd-security/2026-August/000557.html) | `SOCK_STREAM` Unix-domain receive with SCM_RIGHTS error handling; advisory affects FreeBSD 15.0+ | The browser has used sockets, but no 14.00 SCM_RIGHTS error-path or matching kernel implementation was measured. | No device trigger from this advisory alone. |
| [SA-26:65.kqueue](https://lists.freebsd.org/archives/freebsd-security-notifications/2026-September/000132.html) | Copy-on-fork kqueue, concurrent descriptor-table growth; advisory affects FreeBSD 15.1 | The browser can create a queue, but no copy-on-fork mode or child-process capability has been shown. | Prerequisite missing. |
| [SA-26:62.tty](https://lists.freebsd.org/archives/freebsd-security/2026-August/000562.html) | Controlling-TTY ioctl during terminal destruction | The measured browser `/dev` listing has no tty entry; no terminal-control path has been established. | Prerequisite missing. |
| [SA-26:69.udp](https://lists.freebsd.org/archives/freebsd-security-notifications/2026-September/000136.html) | Classic non-VNET jail with IPv6 loopback traffic | The browser's 14.00 process record has its upstream `P_JAILED` bit clear under the matching layout; Sony policy may differ, but there is no classic-jail prerequisite. | Low priority. |
| [SA-26:19.file](https://lists.freebsd.org/archives/freebsd-security/2026-May/000453.html) | A vulnerable wait/close file-descriptor type | Existing 14.00 socket/queue close-reuse tests gave ordinary results; process descriptors have no wrapper in the measured inventory. | Existing [fd-race record](FD_REGISTRATION_RACE_14.md) remains the gate; do not replay the same schedule. |
| [SA-26:37.vm](https://www.freebsd.org/security/advisories/FreeBSD-SA-26:37.vm.asc) | A mapped unmanaged device-pager object, then invalidate/fault | Anonymous `mmap` worked, but a read-only shared map of `/dev/dmem0` returned `EPERM` on 14.00. | [Tested device prerequisite denied](DEVICE_PAGER_GATE_14.md); do not run invalidate/fault on this node. |
| [SA-26:44.posixshm](https://www.freebsd.org/security/advisories/FreeBSD-SA-26:44.posixshm.asc), [SA-26:63.posixshm](https://www.freebsd.org/security/advisories/FreeBSD-SA-26:63.posixshm.asc) | Largepage POSIX shared-memory object and its special operations | Number-482 is present and historically named `shm_open`, but the [full 344 KiB mapped-code census](SANDBOX_WRAPPER_CENSUS_14.md) did not locate 571 (`shm_open2`); no largepage object has been created. | Largepage prerequisite unproven; an ordinary shared-memory entry alone does not exercise these bugs. |
| [SA-26:39.execve](https://www.freebsd.org/security/advisories/FreeBSD-SA-26:39.execve.asc) | SUID execution plus procfs/linprocfs write access during credential change | This browser has no demonstrated SUID launch or procfs write path; its service launch request was denied. | Missing both prerequisites. |
| [SA-26:26.ktls](https://raw.githubusercontent.com/freebsd/freebsd-doc/main/website/static/security/advisories/FreeBSD-SA-26:26.ktls.asc) | Software KTLS receive on a loopback socket carrying file-backed pages | A known-name `sysctl` control resolved, but `kern.ipc.tls.enable` returned ENOENT on 14.00. | [Named facility absent](KTLS_GATE_14.md); no KTLS socket trigger. |

The 14.00 [process record](PROCESS_BOUNDARY_MODEL_14.md), [filesystem
view](SANDBOX_BOUNDARY_14.md), and [fd comparison](FD_REGISTRATION_RACE_14.md)
are the device observations used above. The screen found no candidate
that justifies a fresh destructive probe today. The next device test
needs a new 14.00 prerequisite measurement or an independently observable
authority/kernel-data effect.

**2026-10-25 clock-ID addendum:** The [read-only ID-16 comparison](CLOCK16_GATE_14.md)
found that 14.00 number 232 returns a timestamp exactly 1,500 ms ahead
of realtime, while number 234 rejects ID 16 with `EINVAL`. FreeBSD 15's
`CLOCK_TAI` contract accepts ID 16 in both clock calls. This lowers the
priority of [SA-26:51.ktimer](https://www.freebsd.org/security/advisories/FreeBSD-SA-26:51.ktimer.asc)
for this console; no timer was created or old-value disclosure attempted.
