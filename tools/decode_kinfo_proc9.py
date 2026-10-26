"""Compare a captured 14.00 process record with the FreeBSD 9 amd64 prefix.

This is a layout comparison, not proof that Sony uses an unmodified kernel.
Only scalar identity/policy fields are printed; captured pointer words stay in
the immutable source capture.
"""

from __future__ import annotations

import ctypes as c
import json
import sys
from pathlib import Path


class KinfoProcPrefix(c.Structure):
    _fields_ = [
        ("ki_structsize", c.c_int32),
        ("ki_layout", c.c_int32),
        ("_pointers", c.c_uint64 * 8),
        ("ki_pid", c.c_int32),
        ("ki_ppid", c.c_int32),
        ("ki_pgid", c.c_int32),
        ("ki_tpgid", c.c_int32),
        ("ki_sid", c.c_int32),
        ("ki_tsid", c.c_int32),
        ("ki_jobc", c.c_int16),
        ("_spare_short1", c.c_int16),
        ("ki_tdev", c.c_uint32),
        ("_sigsets", c.c_uint32 * 16),
        ("ki_uid", c.c_uint32),
        ("ki_ruid", c.c_uint32),
        ("ki_svuid", c.c_uint32),
        ("ki_rgid", c.c_uint32),
        ("ki_svgid", c.c_uint32),
        ("ki_ngroups", c.c_int16),
        ("_spare_short2", c.c_int16),
        ("ki_groups", c.c_uint32 * 16),
        ("ki_size", c.c_uint64),
        ("_segment_sizes", c.c_int64 * 5),
        ("ki_xstat", c.c_uint16),
        ("ki_acflag", c.c_uint16),
        ("ki_pctcpu", c.c_uint32),
        ("ki_estcpu", c.c_uint32),
        ("ki_slptime", c.c_uint32),
        ("ki_swtime", c.c_uint32),
        ("ki_cow", c.c_uint32),
        ("ki_runtime", c.c_uint64),
        ("_timevals", c.c_int64 * 4),
        ("ki_flag", c.c_int64),
        ("ki_kiflag", c.c_int64),
        ("ki_traceflag", c.c_int32),
        ("ki_stat", c.c_uint8),
        ("ki_nice", c.c_int8),
        ("ki_lock", c.c_uint8),
        ("ki_rqindex", c.c_uint8),
        ("ki_oncpu", c.c_uint8),
        ("ki_lastcpu", c.c_uint8),
        ("ki_tdname", c.c_char * 17),
        ("ki_wmesg", c.c_char * 9),
        ("ki_login", c.c_char * 18),
        ("ki_lockname", c.c_char * 9),
        ("ki_comm", c.c_char * 20),
        ("ki_emul", c.c_char * 17),
        ("ki_loginclass", c.c_char * 18),
        ("ki_sparestrings", c.c_char * 50),
        ("ki_spareints", c.c_int32 * 7),
        ("ki_flag2", c.c_int32),
        ("ki_fibnum", c.c_int32),
        ("ki_cr_flags", c.c_uint32),
        ("ki_jid", c.c_int32),
        ("ki_numthreads", c.c_int32),
        ("ki_tid", c.c_int32),
    ]


def decode(path: Path) -> dict:
    capture = json.loads(path.read_text(encoding="utf-8"))
    check = capture["submission"]["checks"][0]
    detail = check["details"]
    data = bytes.fromhex("".join(detail[f"bytes_{i}"] for i in range(5)))
    if len(data) != 1096:
        raise ValueError(f"expected 1096 bytes, got {len(data)}")
    record = KinfoProcPrefix.from_buffer_copy(data)
    fields = ("ki_structsize", "ki_layout", "ki_pid", "ki_ppid", "ki_uid",
              "ki_ruid", "ki_svuid", "ki_flag", "ki_flag2",
              "ki_fibnum", "ki_cr_flags", "ki_jid", "ki_numthreads", "ki_tid")
    values = {name: getattr(record, name) for name in fields}
    values["ki_spareints"] = list(record.ki_spareints)
    values["ki_comm"] = record.ki_comm.split(b"\0", 1)[0].decode("ascii", "replace")
    values["upstream_p_jailed_bit"] = bool(record.ki_flag & 0x1000000)
    values["upstream_capmode_bit"] = bool(record.ki_cr_flags & 1)
    return {
        "capture_id": capture["capture_id"],
        "prefix_size": c.sizeof(KinfoProcPrefix),
        "offsets": {name: getattr(KinfoProcPrefix, name).offset for name in fields},
        "values": values,
        "cross_checks": {
            "structure_size": values["ki_structsize"] == detail["struct_size"] == 1096,
            "self_pid": values["ki_pid"] == detail["self_pid"],
            "parent_pid_present": values["ki_ppid"] > 0,
            "effective_uid": values["ki_uid"] == 1,
        },
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: decode_kinfo_proc9.py CAPTURE.json")
    print(json.dumps(decode(Path(sys.argv[1])), indent=2))
