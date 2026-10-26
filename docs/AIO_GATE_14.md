# AIO entry-point gate on retail PS4 14.00

The current project has byte-checked the number-661 and number-668
wrappers in the live WebProcess. Historical public syscall tables name
them `aio_submit` and `aio_create` respectively. Those names guide
research; they are not proof of the running 14.00 argument contracts.

Four earlier malformed number-661 calls ended the browser before a
result capture (see [report P3](REPORT_P3_DRAFT.md)). On 2026-10-22 a
new, fully calibrated page ran a pinned number-668 entry check
([source](../probes/clone_history_aio_create_gate_v1.js), command
`be98dce265c8457588fa975119ccf982`). The collector received the
authenticated `aio668_before_0` marker for the null-argument call.
It received no after-call marker or result, and the page stopped
polling. The operator immediately reported a PS4 memory warning; after
dismissing it, the page refreshed and connected under a new session ID.
The owned-pointer second shape was not reached.

This is another browser interruption under a malformed AIO-family
call. It supplies no syscall return, kernel error, AIO handle, kernel
fault signature, or sandbox escape. The next AIO test requires a
14.00-compatible request structure or other discriminating oracle;
repeating null calls is not useful.
