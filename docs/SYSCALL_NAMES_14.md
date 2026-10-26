# Candidate syscall names for the 14.00 wrapper census (545–677)

The fixed wrapper numbers and live return behavior in this project are
14.00 observations. The names below come from historical PS4/FreeBSD
tables and source correlations; they are ABI hypotheses unless a current
binary callsite and live contract independently support them. The formerly
cited `references/hitodama_include_sys_syscall.h` is not present in this
tree, so it is not local evidence. Numbers, names, and argument layouts
must not be treated as 14.00 symbols merely because they align with a
5.05-era table. Captures referenced are from the census sweeps (see
`NAMEDOBJ_14.md` and `PROGRESS.md`).

## Historical-name interpretations of observed classifications

**Event filter family (evf_\*, 538–546)** — explains the ESRCH class:
540 evf_open, 541 evf_close, 542 evf_wait, 543 evf_trywait, 544
evf_set, 545 evf_clear, 546 evf_cancel. Our ESRCH-all results on
545/546 = clearing/cancelling nonexistent evf IDs. Note 540's
"unreplicated writer" event (10/16) is evf_open — it OPENS an event
filter by name; ESRCH = no such filter. That reading is safer than
the "writes" hypothesis.

**Orbis semaphore family (osem_\*, 549–556):** 549 osem_create, 550
osem_delete, **551 osem_open**, 552 osem_close, 553 osem_wait, 554
osem_trywait, 555 osem_post, 556 osem_cancel. Our ESRCH-all on
550/552/555/556 and the 551-pair ESRCHs are nonexistent-ID/name
results. **Correction: 551 is an OPENER (lookup by name), not a
creator** — the earlier "551 = sibling creator" reading is wrong; we
never created an osem (that is 549's job). This also fully explains
why 557-created names never resolved in 551: different object type.

**NamedObj candidate:** historical tables label 557 `namedobj_create`
and 558 `namedobj_delete`. That interpretation is consistent with the
generation-validated create/delete behavior in `NAMEDOBJ_14.md`, but it
does not make 558 a generic AIO-ID deletion operation.

**Historically named introspection/VM class (the EPERM wall):** 559
set_vm_container, 561 suspend_process, 562 resume_process, 586
dmem_container, 600 sandbox_path, 603 rdup, 604 dl_get_metadata, 611
get_paging_stats_of_all_threads, 613 get_resident_count, 614
prepare_to_suspend_process, 615 get_resident_fmem_count. All our
EPERM-all results are operations that require rights above the game/
browser sandbox under those historical interpretations. The observed
`EPERM` values form a boundary map; the names remain hypotheses.

**OPMC (performance counters):** 563 opmc_enable, 564 opmc_disable,
565 opmc_set_ctl, 566 opmc_set_ctr, 567 opmc_get_ctr. Our ret-0-zero-
args on 563–566 = enable/disable/set with zeroed ctl. 567 ESRCH-z =
no counter allocated. (Historic jailbreak note: OPMC enable has been
used for kernel-timing oracles; ret-0 from the browser means the call
is admitted — whether 14.00 actually arms counters for a sandboxed
caller is untested.)

**Loader block (591–608):** 591 dynlib_dlsym, 592 dynlib_get_list,
593 dynlib_get_info, 594 dynlib_load_prx, **595 dynlib_unload_prx**,
596 dynlib_do_copy_relocations, 597 dynlib_prepare_dlclose, **598
dynlib_get_proc_param**, 599 dynlib_process_needed_and_relocate, 608
dynlib_get_info_ex. This corrects two readings:

- **595 is dynlib_unload_prx, not a lookup.** The ESRCH-all results =
  unloading nonexistent handles; the one WebProcess crash
  (`clone_history_595_overflow_v1`, stale-address boot) was an unload
  with garbage extra args. Not a mystery anymore.
- **598 is dynlib_get_proc_param.** The "ORBIS-signed root structure"
  we walked (root page with `ORBI\5` magic, SceNKWebProcess string
  table, config keys, sub-structs, cross-region pointer) is the
  browser's **ProcParam** block from the SELF. It is mapped into our
  address space and our userland write primitive can change its root.
  A fresh 14.00 read measured `0x14008001` at root `+0x10`, matching
  the separately queried SDK version and published ProcParam layout;
  the adjacent `+0x14` high word is zero. The earlier claim that this
  location held a browser memory limit is withdrawn. Whether a 14.00
  kernel path re-reads other ProcParam fields lazily remains untested.

**Misc:** 547 query_memory_protection (EINVAL-all = bad arg shapes),
548 batch_map (ret-0 zero-args; VM batch op — real ABI from SDK
headers needed before it means anything), 560 sys_debug_init (ret-0),
585 is_in_sandbox (ret 1; the table has a duplicate `584` label —
table bug, 585 is the right number per our own call), 587
get_authinfo, **588 mname** (the name alone does not establish whether
this sets or reads a mapping name; our older EFAULT result did not
determine its 14.00 contract), 601 mdbg_service, 602
randomized_path, 605 workaround8849 (EINVAL-all = compat stub), 606
is_development_mode (ret 0 = retail), 607 get_self_auth_info, 610
budget_get_ptype (sampled small IDs returned ENOSYS; 0xffffffff returned 2), 612 get_proc_type_info,
616 thr_get_name (ESRCH = nonexistent TID — not an object table), 617
set_gpo (ret 0).

## Unnamed on 14.00 (post-5.05 numbers)

The local 5.05-era table stops at 617, but later public tables list tentative names for 618+. Their present 14.00 contracts still require device checks. Our interesting ones are **622
ipmimgr_call** (known from our client work), **624** (historical name `get_vm_map_timestamp`; a direct [14.00 sequence](VM_TIMESTAMP_14.md) was nondecreasing and sometimes repeated, so changing returns are not demonstrated object IDs; 632/633/634 reject those values),
**638** (historical `utc_to_localtime`; measured outputs equal input minus six hours), **659** (`dynlib_get_list2`), **660** (`dynlib_get_info2`), and **661** (`aio_submit`; malformed calls ended the WebProcess). These are historical names requiring current ABI checks on 14.00.

## What this changes

1. The EPERM list is now a **named privilege manifest** — useful for
   the report (what a sandboxed process may not do) and for judging
   any future credential win (each becomes callable).
2. 598/dynlib_get_proc_param gives the ORBIS-structure recon a real
   identity and a candidate experiment (kernel re-read of ProcParam).
3. 588/mname and 548/batch_map have named, testable ABIs to chase.
4. The evf/osem families are the standard SyncManager objects — well
   trodden, low surprise value; deprioritize.
5. The current contracts of 624 and 661 remain unresolved. The 638 time arithmetic and historical name invalidate the earlier kernel-base reading.

## 669–677 live wrapper tail (2026-10-23)

The hash-checked 14.00 `libkernel_web.sprx` has fixed-number wrappers
through 677. Historical [PS4 syscall tables](https://www.psdevwiki.com/ps4/Syscalls)
name 669 `aio_submit_cmd`, 670 `aio_init`, 671 `get_page_table_stats`,
672 `dynlib_get_list_for_libdbg`, 673 `blockpool_move`, 674
`virtual_query_all`, 675 `reserve_2mb_page`, 676 `cpumode_yield`, and
677 `get_phys_page_size`. The name is an ABI lead, not a verified 14.00
contract. Our [14.00 AIO record](AIO_14.md) now validates a 40-byte
one-request and two-request `aio_submit_cmd` read through 669. This
does not validate the older AIO race on 14.00. The other tail entries
have only first-pass error and zero-argument results in that record.
