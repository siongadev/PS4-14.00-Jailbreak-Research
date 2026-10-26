# Source-mentioned device paths in the 14.00 browser view

The complete 26-module browser snapshot contains device-path strings that
could suggest privileged interfaces. A path string identifies client code;
it does not show that the browser can open that node. The earlier guarded
`/dev` directory read listed `dipsw`, `random`, `urandom`, `dmem0`, `dce`, and
`rng` in this browser's filesystem view
([raw capture](../captures/132cf21296bc40c1aa70a80f483b721c.json)).

The [new read-only census](../captures/f98454a3a44c4e10bd450a607fc7f615.json)
used the current page's owned frame and byte-checked native-call helper. It
issued `open(path, O_RDONLY, 0)` for ten literal paths in the captured
`libkernel_web` and libc modules, read errno immediately, and would have
closed any valid descriptor. All ten returned `-1`/`ENOENT` (`2`):
`/dev/null`, `/dev/console`, `/dev/deci_coredump`, `/dev/deci_tty6`,
`/dev/evlg0`, `/dev/evlg1`, `/dev/gbase`, `/dev/icc_configuration`,
`/dev/icc_device_power`, and `/dev/icc_fan`. The browser PID remained 74;
the owned frame and JSArray state restored. Source SHA-256:
`e6f2bae08e4ca41e588328bfa511ffc19a9da3c635015b722c4b11f9ed860430`;
capture SHA-256:
`882ef371a1aeb774894dc77ec73899d2c9bca0d24081d2b4dbc7c6df0783d44b`.

The same page then passed a [matched pointer and wrapper control](../captures/3ded3c2ab2a649b38230d79ac14e3e8d.json):
`/dev/random`, `/dev/rng`, and `/dev/dmem0` each opened as fd 9 and closed
with return 0, while `/dev/null` again returned `ENOENT`. It performed no
read, write, ioctl, or mapping. Source SHA-256:
`5cfcd2ba258b69179917628e8002e922a9117ed7109fb192053c9a14ec5e03b8`;
capture SHA-256:
`8282cfa706110bd25e353b816e5dcce2436aca4d17e45a3e783c6a3c009d6b17`.
The positive opens support the pointer and call setup for the ten-path
negative result. `ENOENT` establishes absence in this view under the tested
names; it does not reveal whether a global node exists or how a privileged
process would reach it.

Two preceding command captures are protocol failures, not device outcomes:
the [first](../captures/4c93bf73d9304a2882d1d46c51afd6ed.json) exceeded
the synchronous-marker contract, and the
[second](../captures/73c89a3a97d04875b93c9984e9bf6eec.json) packed all
rows into a detail string longer than the collector limit. Their results
were not used for the census conclusion. The v3 probe comment calls
`/dev/null` a positive control; that comment was incorrect. The earlier
14.00 capture had already measured `ENOENT` for it, and the separate
`/dev/random` control above supplies the actual positive check.

The source-matched `/dev/authmgr` and `/dev/bpf0` opens were already
measured separately with their client flags and also returned `ENOENT`
([Sysmodule](SYSMODULE_CLIENT_14.md), [Net](NET_DEVICE_GATE_14.md)). These
specific device routes now have an access gate in the observed browser
view. A new device lead should first identify a node that exists on 14.00
and a concrete client operation; more path strings alone are not evidence
of a sandbox escape.

SystemService's [14.00 callsite](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/system_service_device_selected.txt)
at RX+`0x28110` opens `/dev/sbl_srv` with flags `2` and stores the returned
descriptor. The [source-matched open-only test](../captures/610c1c9488f54c9292a823afbbc34ea4.json)
returned `-1` with immediate `ENOENT`, restored the owned frame, and
confirmed PID 74 afterward. No device operation ran. This capture is
SHA-256 `952b6dacad38bdf54bfce1f51c552e42aab2172ce3ad51e6186c229c0101cb3a`;
the pinned probe source is SHA-256
`8faa87ba82de97e5b0e12273707fe5158c1356047f20276efcc42974ef40a507`.
