# Poll/select file-descriptor UAF reachability screen

The [FreeBSD-SA-26:19.file advisory](https://lists.freebsd.org/archives/freebsd-security/2026-May/000453.html)
describes CVE-2026-45251: a blocked `poll`/`select` waiter can outlive
certain file-descriptor objects when another thread closes the descriptor.
The [official FreeBSD 14 patch](https://security.freebsd.org/patches/SA-26:19/file-14.patch)
changes `netmap` selinfo teardown and process-descriptor (`procdesc`)
teardown/selection. Those are the concrete upstream descriptor types in
this patch. A normal browser socket `poll`/close loop is not by itself a
test of the fixed paths.

On the retail PS4 reporting 14.00, a guarded `/dev` directory read listed
`dipsw`, `random`, `urandom`, `dmem0`, `dce`, and `rng`, with no `netmap`
node in that browser view. [Directory evidence](SANDBOX_BOUNDARY_14.md).
The hash-verified full `libkernel_web` wrapper census found no ordinary
fixed-number wrapper for syscall 518, the upstream `pdfork` entry that
creates a process descriptor. [Wrapper census](SANDBOX_WRAPPER_CENSUS_14.md).
The project has no validated process-descriptor creation path or netmap
descriptor on PS4 14.00. This is a reachability limit, not proof that
Sony's kernel lacks either feature internally or shares FreeBSD's fix.

**Decision:** do not run a generic socket `poll`/close race under this
CVE label. Reconsider only if a 14.00 browser-accessible affected
descriptor type and a reproducible wait/close oracle are independently
established.
