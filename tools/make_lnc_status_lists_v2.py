"""Version the one-entry LNC list probes with the 14.00 input-pointer ABI."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def make(kind: str, chunks: int) -> None:
    stem = f"clone_history_lnc_{kind}_list"
    source = (PROBES / f"{stem}_v1.js").read_text(encoding="utf-8")
    old = "put64(0x550,n.frameAddress+0x590);"
    assert source.count(old) == 1
    source = source.replace(
        old,
        "put64(0x570,n.frameAddress+0x590);\n"
        "    put64(0x550,n.frameAddress+0x570);",
    )
    old_status = 'status:restored&&guard?"pass":"fail"'
    assert source.count(old_status) == 1
    source = source.replace(
        old_status,
        'status:restored&&guard&&raw&&raw.value===0&&raw.high===0&&'
        'sysResult===0&&methodResult===0?"pass":"fail"',
    )
    old_check = f"lnc_{kind}_list_v1"
    assert source.count(old_check) == 1
    source = source.replace(old_check, f"lnc_{kind}_list_v2")
    (PROBES / f"{stem}_v2.js").write_text(source, encoding="utf-8")
    check_ids = [f"lnc_{kind}_list_v2"] + [
        f"lnc_{kind}_bytes_{i}" for i in range(chunks)
    ]
    manifest = {
        "probe_id": f"{stem}_v2",
        "script": f"{stem}_v2.js",
        "check_ids": check_ids,
        "timeout_ms": 30000,
    }
    (PROBES / f"{stem}_v2.json").write_text(
        json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    make("reboot", 5)
    make("local", 1)
