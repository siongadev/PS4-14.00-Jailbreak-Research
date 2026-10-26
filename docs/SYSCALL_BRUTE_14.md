# Brute-force syscall follow-up — PS4 firmware 14.00

Updated 2026-10-22. This record separates device-observed effects from
return codes and historical syscall names. The console's System
Information was checked as 14.00; the captures also carry its browser
user agent. A public [PS4 syscall table](https://github.com/a0zhar/PS4-SCE/blob/main/syscalls.md)
guides ABI interpretation but is not a 14.00 kernel binary.

## 595: a live browser module was removed

The brute-force [capture](../captures/49ff05f8aa2e4515b008cdc6720ee3a6.json)
returned `0` for syscall 595 with first argument `16`. The log prints
integer labels in hexadecimal, so `10=0` denotes handle `0x10` = 16.
That run did not take a module list around the call.

In a later 14.00 WebProcess (session
`14df9489b8904248a8870b634d1679ab`, PID 62), a guarded
[592 baseline](../captures/04dd19aa9fc447e89da5a90286dfe3c6.json)
returned 27 handles including 16. A dedicated command called 595 once
with handle 16, with authenticated markers for its before-list,
before-call, after-call, and after-list steps. Its intended result was
rejected by the collector because it exceeded the 12-detail-field
limit; [that error capture](../captures/e1fc36a02ded4b3e94c1ad0d38a8a28c.json)
does **not** contain the call's return or the in-command lists. An
immediate, separately captured [592 post-list](../captures/b409b478423340c69bc984ce7fd07625.json)
reported PID 62 and 26 handles, with 16 absent and every other
baseline handle still present. The operator reported a responsive page
and no memory warning. The historical name `dynlib_unload_prx` and an
earlier 14.00 module-name capture identify handle 16 as
`libSceSysmodule.sprx` in this process type.

This is evidence of a **process-local module unload** on 14.00. It does
not show privilege change, code execution in another process, or a
sandbox escape. The corrected
[`dynlib_unload_verify_v1` probe](../probes/clone_history_dynlib_unload_verify_v1.js)
now fits the collector limit for an independent single-capture repeat
on a new process.

## 601: request dispatch is live, but request 4 has no observed output

The brute-force capture gave EFAULT for request 1 with null arg2 and
`0` for request 4. A separate [request-4 repeat](../captures/70e62a07d2904c0db9cf98e539626340.json)
also returned `0`, with PID 62 unchanged. Request 4 with an owned,
zeroed, guarded arg2 buffer
[returned `0` and changed no bytes](../captures/5ee436b7fc2e4172b23bf7d96130e076.json).
It still [returned `0` with invalid arg2=1](../captures/ffd449f65daa4f75838b64e55fedee3c.json).
An in-process [before/after state check](../captures/c7e1e0688fea4520b1a59764e62914c0.json)
then returned `0` for request 4 while `is_in_sandbox`, development-mode,
and `sandbox_path` results stayed exactly `1,0,-1/1`, with PID 62
unchanged. Thus request 4 does not dereference arg2 in the tested shapes
and has no effect on these three measured indicators. It is not an
established kernel primitive.

Request 1 with a readable zeroed buffer
[returned EINVAL](../captures/fc12c08361354d1ea84ed486c4b05022.json),
contrasting with null arg2's EFAULT. Adding one bounded ASCII string
to the buffer left it at
[EINVAL](../captures/789cebef51954e2ba6d68c17621c52ed.json).
On a later clean 14.00 page, an identical request buffer and name
returned EINVAL both before and after creating a matching `0x4000`
557 object; the owned object was deleted and all bytes restored
([capture](../captures/3d7311c503f140ffbfa2893d8ba605a3.json)).
This supports a reachable validation path after the buffer check, but
does not identify the request structure or a usable operation.
[Two selector-3 attempts](MDBG_SELECTOR_14.md), one with an owned zero
buffer and one with null, each reached its before-call marker and then
lost the browser page. The operator saw a memory warning after each.
Neither produced a return capture or evidence of a sandbox crossing;
repeating selector 3 without a different oracle is low value.
[Older kernel analysis](https://fail0verflow.com/blog/2017/ps4-namedobj-exploit/)
also describes arg1 as a request selector and arg2 as a user pointer
for case 1; only the captures above describe behavior on 14.00.

## 557/558: 14.00 kind distinction reopens one narrow question

The earlier NamedObj study closed a **stale-generation handle** variant,
not every interaction with `mdbg_service`. A new owned-object
[kind-gate capture](../captures/ea8917da8f3344dab79b8acb5ed99138.json)
created a 557 handle (`8288`) with arg3 `0x4000`. Deleting it with
558 kind `0` returned `ESRCH`; deleting the same live handle with kind
`0x4000` returned `0`. PID and the JS carrier were preserved. This is
direct 14.00 evidence that the kind argument selects a distinct lookup
class. Earlier 14.00 tests tried 557 arg3 values only through `0x2001`
and inferred too much from unchanged handle numbers. The 2017 source
describes `0x4000` combining with `0x1000` to select its debug object
class, but whether 14.00 still has the vulnerable cross-type update is
**unknown**. The device test did not call 601 on a live 557 object.

## Corrections to other brute-force interpretations

- Syscall 624's changing positive values are not demonstrated object
  handles. Public tables call 624 `get_vm_map_timestamp`.
- Syscall 610's small-value ENOSYS and `0xffffffff→2` are
  argument-dependent `budget_get_ptype` responses, not proof of a
  budget authority path. A new 14.00 [16-case 610 matrix](../captures/a091a962dd4a480589ce290d5f85d004.json)
  repeated the `2` only at `0xffffffff`; a process-owned second-argument
  buffer changed no bytes for any tested first argument, including that
  successful one. A matched [619 matrix](../captures/5a39c9be45544a678bdee831604cbdfb.json)
  returned ENOSYS for all 16 tested shapes, with no buffer change. The
  earlier claim that 619 returned `2` at `0xffffffff` was unsupported:
  the [original brute-force capture](../captures/71a37bf140f14c40bce30f08a70c3056.json)
  truncated its 619 integer row before saving it.
- Number 638's three measured outputs equal the input minus 21,600
  seconds; the former kernel-base derivation is withdrawn. See the
  [corrected 638 record](KBASE_CONSTANCY_14.md).
- Historical tables name 661 `aio_submit`, not intentional process
  exit. The malformed 14.00 calls ended the WebProcess without a
  return capture; their failure mechanism is unknown.

The next meaningful device result must expose an unauthorized state
change or a reproducible kernel data transfer. More success codes
alone will not move the sandbox-escape milestone.
