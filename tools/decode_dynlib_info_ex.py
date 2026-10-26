"""Verify and reconstruct the guarded 14.00 system-service info-ex record."""

import base64
import hashlib
import json
from pathlib import Path
import struct

from fw14lab.verify import verify_capture


ROOT = Path(__file__).resolve().parents[1]
CAPTURE_ID = "739c120693c343e6897efc0df3ba450c"
OUT = ROOT / "evidence" / "live" / "system_service_info_ex_14.00.bin"


def main() -> None:
    record = verify_capture(ROOT / "captures" / f"{CAPTURE_ID}.json")
    check = record["submission"]["checks"][0]
    details = check["details"]
    if (check["status"] != "pass" or details["module_handle"] != 49 or
            details["guard_intact"] is not True or
            details["carrier_restored"] is not True):
        raise ValueError("module-info capture gate failed")
    raw = b"".join(base64.b64decode(details[f"raw{n}"], validate=True)
                   for n in range(3))
    returned_size = struct.unpack_from("<Q", raw)[0]
    if len(raw) != 0x1A8 or returned_size not in (0, 0x1A8):
        raise ValueError("module-info record length or returned size changed")
    OUT.write_bytes(raw)
    name = raw[8:264].split(b"\0", 1)[0].decode("ascii")
    report = {
        "capture_id": CAPTURE_ID,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "returned_size_field": returned_size,
        "name": name,
        "module_id": struct.unpack_from("<I", raw, 0x108)[0],
        "segment_count": struct.unpack_from("<I", raw, 0x1A0)[0],
        "ref_count": struct.unpack_from("<I", raw, 0x1A4)[0],
        "nonzero_words_after_name": [
            {"offset": hex(offset), "value": hex(struct.unpack_from("<Q", raw, offset)[0])}
            for offset in range(0x108, 0x1A0, 8)
            if struct.unpack_from("<Q", raw, offset)[0]
        ],
    }
    OUT.with_suffix(".json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
