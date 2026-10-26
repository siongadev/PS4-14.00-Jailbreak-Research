"""Wrap the measured 14.00 system-service RX bytes for offline analysis.

The output is synthetic. It is not a Sony SELF, a complete module, or a
replacement executable.
"""

import hashlib
import json
from pathlib import Path
import struct

from fw14lab.verify import verify_capture


ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / "evidence" / "live" / "rx_0x83711c000_14.00.bin"
ELF = ROOT / "evidence" / "live" / "rx_0x83711c000_14.00.synthetic.elf"
BASE = 0x83711C000
SIZE = 0x3C000
SAMPLE_ID = "28943da7cfca4b1da4316bb897f9e35c"


def main() -> None:
    image = IMAGE.read_bytes()
    sample = verify_capture(ROOT / "captures" / f"{SAMPLE_ID}.json")
    expected = bytes.fromhex(sample["submission"]["checks"][0]["details"]["head_hex"])
    if len(image) != SIZE or image[:64] != expected:
        raise ValueError("live image size or independent sample mismatch")
    ident = b"\x7fELF" + bytes([2, 1, 1, 0]) + bytes(8)
    header = struct.pack(
        "<16sHHIQQQIHHHHHH", ident, 2, 62, 1,
        BASE, 64, 0, 0, 64, 56, 1, 0, 0, 0,
    )
    segment = struct.pack(
        "<IIQQQQQQ", 1, 5, 0x1000, BASE, BASE,
        SIZE, SIZE, 0x1000,
    )
    synthetic = header + segment + bytes(0x1000 - len(header) - len(segment)) + image
    ELF.write_bytes(synthetic)
    metadata = {
        "kind": "analysis-only synthetic ELF",
        "not_original_binary": True,
        "module_name": "libSceSystemService.sprx",
        "memory_range": "0x83711c000-0x837158000",
        "memory_bytes_sha256": hashlib.sha256(image).hexdigest(),
        "independent_sample_capture_id": SAMPLE_ID,
        "module_info_ex_capture_id": "739c120693c343e6897efc0df3ba450c",
        "synthetic_sha256": hashlib.sha256(synthetic).hexdigest(),
    }
    ELF.with_suffix(".json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
