"""Recover the live main-image import stubs from one 14.00 process dump.

The mapped segments are not an on-disk SELF/ELF. No old-firmware offsets are
used, and absolute addresses belong only to this captured process.
"""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct

import capstone


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SESSION = "cae1c2f0636c4430ab13130bf6e1d974"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", default=DEFAULT_SESSION)
    args = parser.parse_args()
    session = ROOT / "evidence/live/full_process" / args.session
    manifest = json.loads((session / "manifest.json").read_text())
    matches = json.loads((session / "rx_comparison.json").read_text())
    module_by_rx = {m["index"]: m["matching_sprx"] for m in matches["maps"]}
    maps = manifest["maps"]
    main_maps = maps[:3]
    if [m["kind"] for m in main_maps] != ["rx", "ro", "rw"]:
        raise ValueError("first three mappings are not main RX/RO/RW")

    def verified(item: dict) -> bytes:
        data = (ROOT / item["file"]).read_bytes()
        if len(data) != item["size"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError(f"map {item['index']} failed integrity check")
        return data

    rx, ro, rw = [verified(m) for m in main_maps]
    if b"SceNKWebProcessMain\x00" not in rx or b"FMEMSizeLimit\x00" not in rx:
        raise ValueError("main-image identity or config key missing")
    ro_start = main_maps[1]["start"]
    imports = []
    for off in range(len(rx) - 6):
        if rx[off:off + 2] != b"\xff\x25":
            continue
        disp = struct.unpack_from("<i", rx, off + 2)[0]
        slot = main_maps[0]["start"] + off + 6 + disp
        if not ro_start <= slot <= ro_start + len(ro) - 8:
            continue
        target = struct.unpack_from("<Q", ro, slot - ro_start)[0]
        destination = next((m for m in maps if m["start"] <= target < m["start"] + m["size"]), None)
        if destination is None or destination["kind"] != "rx":
            raise ValueError(f"main import at +0x{off:x} has no captured RX target")
        result = {
            "stub_offset": off,
            "slot_offset_from_main_ro": slot - ro_start,
            "target_module": module_by_rx.get(destination["index"]),
            "target_rx_offset": target - destination["start"],
        }
        target_data = verified(destination)
        target_off = result["target_rx_offset"]
        window = target_data[target_off:target_off + 13]
        if (len(window) == 13 and window[:3] == b"\x48\xc7\xc0"
                and window[7:11] == b"\x49\x89\xca\x0f"):
            # Require the exact full syscall prefix; the above is only a
            # cheap prefilter and does not assert the wrapper is callable.
            if target_data[target_off + 7:target_off + 12] == b"\x49\x89\xca\x0f\x05":
                result["fixed_syscall_number"] = struct.unpack_from("<I", target_data, target_off + 3)[0]
        imports.append(result)
    keys = []
    for i in range(7):
        ptr = struct.unpack_from("<Q", ro, i * 8)[0]
        if not main_maps[0]["start"] <= ptr < main_maps[0]["start"] + len(rx):
            raise ValueError("startup key pointer is outside main RX")
        off = ptr - main_maps[0]["start"]
        value = rx[off:rx.index(b"\x00", off)].decode("ascii")
        keys.append({"ro_pointer_offset": i * 8, "rx_string_offset": off, "value": value})

    report = {
        "session_id": args.session,
        "pid": manifest["pid"],
        "firmware": manifest["firmware"],
        "main_rx_sha256": main_maps[0]["sha256"],
        "main_ro_sha256": main_maps[1]["sha256"],
        "main_rw_sha256": main_maps[2]["sha256"],
        "main_rx_start": main_maps[0]["start"],
        "import_count": len(imports),
        "imports_by_target_module": dict(Counter(m["target_module"] for m in imports)),
        "startup_keys": keys,
        "imports": imports,
        "limitations": [
            "Names are attributed by hash-matched RX map; no original symbol table is present.",
            "Import target addresses are process-local and not portable across restarts.",
            "Static import bindings do not show whether a call ran or succeeded.",
        ],
    }
    (session / "main_executable_analysis.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_64)
    lines = [f"PS4 14.00 WebProcess main RX SHA-256: {main_maps[0]['sha256']}",
             "Addresses below belong only to this captured PID.", ""]
    for start, end in ((0x3df0, 0x3f10), (0x4780, 0x4810),
                       (0x48f0, 0x4950), (0x57c0, 0x57f0)):
        lines.append(f"=== main RX +0x{start:x}..+0x{end:x} ===")
        for ins in md.disasm(rx[start:end], main_maps[0]["start"] + start):
            lines.append(f"+0x{ins.address - main_maps[0]['start']:04x} "
                         f"{ins.bytes.hex(' '):<30} {ins.mnemonic} {ins.op_str}")
        lines.append("")
    (session / "main_startup_disassembly.txt").write_text(
        "\n".join(lines), encoding="utf-8")
    print("main imports", len(imports), report["imports_by_target_module"])
    print("startup keys", [k["value"] for k in keys])
    print("fixed wrappers", [m for m in imports if "fixed_syscall_number" in m])


if __name__ == "__main__":
    main()
