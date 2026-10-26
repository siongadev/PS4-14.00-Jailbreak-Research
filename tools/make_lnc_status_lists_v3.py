"""Build LNC list probes with the 24-byte descriptor stride seen in 14.00."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def make(kind: str, chunks: int) -> None:
    stem = f"clone_history_lnc_{kind}_list"
    source = (PROBES / f"{stem}_v1.js").read_text(encoding="utf-8")
    # Check the original layout before changing its descriptor stride.
    start = source.index("    put64(0x590,n.frameAddress+0x580);")
    end = source.index("    dv.setUint32(0x540,", start)
    block = source[start:end]
    expected = (
        "    put64(0x590,n.frameAddress+0x580);\n"
        "    put64(0x598,4);\n"
        "    put64(0x5a0,n.frameAddress+0x600);\n"
        f"    put64(0x5a8,0x{0x42c if kind == 'reboot' else 0x24:x});\n"
        "    put64(0x5b0,n.frameAddress+0x584);\n"
        "    put64(0x5b8,4);\n"
    )
    if block != expected:
        raise ValueError("v1 descriptor block changed")
    replacement = (
        "    put64(0x590,n.frameAddress+0x580);\n"
        "    put64(0x598,4);\n"
        "    put64(0x5a0,0);\n"
        "    put64(0x5b0,n.frameAddress+0x600);\n"
        f"    put64(0x5b8,0x{0x42c if kind == 'reboot' else 0x24:x});\n"
        "    put64(0x5c0,0);\n"
        "    put64(0x5c8,n.frameAddress+0x584);\n"
        "    put64(0x5d0,4);\n"
        "    put64(0x5d8,0);\n"
    )
    source = source[:start] + replacement + source[end:]
    old_pointer = "put64(0x558,n.frameAddress+0x5a0);"
    if source.count(old_pointer) != 1:
        raise ValueError("output pointer changed")
    source = source.replace(old_pointer, "put64(0x558,n.frameAddress+0x5b0);")
    old_status = 'status:restored&&guard?"pass":"fail"'
    if source.count(old_status) != 1:
        raise ValueError("result status changed")
    source = source.replace(
        old_status,
        'status:restored&&guard&&raw&&raw.value===0&&raw.high===0&&'
        'sysResult===0&&methodResult===0?"pass":"fail"',
    )
    old_check = f"lnc_{kind}_list_v1"
    if source.count(old_check) != 1:
        raise ValueError("result check ID changed")
    source = source.replace(old_check, f"lnc_{kind}_list_v3")
    (PROBES / f"{stem}_v3.js").write_text(source, encoding="utf-8")
    manifest = {
        "probe_id": f"{stem}_v3",
        "script": f"{stem}_v3.js",
        "check_ids": [f"lnc_{kind}_list_v3"] + [
            f"lnc_{kind}_bytes_{i}" for i in range(chunks)
        ],
        "timeout_ms": 30000,
    }
    (PROBES / f"{stem}_v3.json").write_text(
        json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    make("reboot", 5)
    make("local", 1)
