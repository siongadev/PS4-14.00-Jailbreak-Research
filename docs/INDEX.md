# Documentation index

Start with [current progress](PROGRESS.md), [evidence rules](EVIDENCE_RULES.md), and [research gates](RESEARCH_GATES.md). The progress report is the current consolidated status; older notes preserve what was believed or tested at the time, including later corrections.

## Browser entry and native execution

- [History deserialization runs](HISTORY_14_RUNS.md) and [minimal out-of-bounds access](HISTORY_NATIVE_OOB_14.md)
- [Neighboring-buffer access](HISTORY_NEIGHBOR_RW_14.md), [fixed-buffer access](HISTORY_FIXED_BUFFER_RW_14.md), and [address-directed read/write](HISTORY_ADDRESS_DIRECTED_RW_14.md)
- [Current-process code read](HISTORY_NATIVE_READ_14.md), [validated gadget provenance](VALIDATED_GADGETS_14.md), and [repeated native call](HISTORY_NATIVE_CALL_14.md)
- [Worker-side native path](SANDBOX_WORKER_PATH_14.md)

## Browser process and sandbox boundary

- [Full SPRX capture](FULL_SPRX_DUMP_14.md), [all loaded modules](ALL_LOADED_MODULES_14.md), and [full WebProcess reverse pass](FULL_WEBPROCESS_REVERSE_14.md)
- [libkernel_web map](LIBKERNEL_WEB_MAP_14.md), [syscall-name correction](SYSCALL_NAMES_14.md), and [sandbox boundary](SANDBOX_BOUNDARY_14.md)
- [System-service image](SYSTEM_SERVICE_IMAGE_14.md), [IPMI client](IPMI_CLIENT_14.md), and [SysCore client](SYSCORE_APP_CLIENT_14.md)
- [Route-socket authority test](ROUTE_SOCKET_14.md), [VideoCore service test](VIDEOCORE_CLIENT_14.md), and [October 24 boundary closeout](OCT24_BOUNDARY_14.md)

## Kernel-facing tests and corrections

- [AIO lifecycle](AIO_14.md), [concurrent AIO runs](AIO_CONCURRENT_RUNS_14.json), and [composition tests](CHAIN_COMPOSITION_14.md)
- [UMTX shared-memory gate](UMTX_SHM_GATE_14.md), [device-pager gate](DEVICE_PAGER_GATE_14.md), and [FD registration race](FD_REGISTRATION_RACE_14.md)
- [Retracted syscall-638 kernel-base claim](KBASE_CONSTANCY_14.md) and [syscall brute-force follow-up](SYSCALL_BRUTE_14.md)

## Other browser leads

- [Canvas native follow-up](CANVAS_NATIVE_FOLLOWUP.md), [structured-clone integrity](CLONE_INTEGRITY_FINDING.md), [TransformStream candidate](TRANSFORM_STREAM_CANDIDATE.md), and [font-loading lead](FONT_FACE_LEAD.md)
- [Public-source attribution limits](PUBLIC_14_SOURCE_GATE.md) and [source provenance](../references/README.md)

All notes live directly in this directory. The mapped-SPRX segment files and their manifest are included in the repository. Other raw capture IDs in the notes refer to local evidence records that are not part of Git; see [archive instructions](../evidence/README.md).

Files named `REPORT_*_DRAFT.md` are historical internal-review drafts. Read their correction notices and the current progress report before citing them as findings.
