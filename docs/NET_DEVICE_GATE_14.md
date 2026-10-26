# PS4 14.00 Net device gate

The complete, hashed browser PID 74 capture includes `libSceNet.sprx`
(handle 29). Its [analysis-only ELF](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/net.elf)
and [focused decompilation](../evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb/analysis_elf/net_device_selected.txt)
show a real BPF client at RX+`0x88d0`: after checking interface/name
inputs, it opens `/dev/bpf0` with flags `2`, then issues requests
`0xc0044266`, `0x80044270`, and `0x8020426c` if preceding steps pass.
The client code does not include the kernel BPF device implementation.

The [open-only probe](../probes/clone_history_bpf_open_v1.js) used the
same fixed path and flags through the current page's byte-checked native
caller. On PS4 14.00 it returned `-1`, errno `2` (`ENOENT`), with browser
PID 74 and the native state restored
([verified capture](../captures/588592bb22914b7ca515958eceb1179b.json),
SHA-256 `627aee95c775750bf1c7d2ffcfb5d01cee4e43d9226caa0934b3a9c4c52bb7bb`).
No BPF ioctl ran. The device is absent from the tested browser namespace,
so this client path cannot currently deliver a kernel BPF request.

The same `libSceNet` image contains `/dev/notification4` opens in IPv6
telemetry senders. Those write-shaped paths have not been used as a
boundary test; a string in the module does not establish device access.
