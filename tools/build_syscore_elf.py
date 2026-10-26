"""Wrap the hash-pinned 14.00 SysCore RX sample for offline disassembly.

The output is an analysis-only ELF, never a shipped Sony module.
"""

import hashlib
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "evidence/live/rx_0x81b340000_14.00.bin"
OUTPUT = ROOT / "evidence/live/rx_0x81b340000_14.00.synthetic.elf"
BASE = 0x81B340000
SIZE = 0x8000
SOURCE_SHA256 = "c45cb886410dcb33b3f63d0db1632a5f0f02c765ed6ad8b37a192b9b151027c7"


def main() -> None:
    image = SOURCE.read_bytes()
    digest = hashlib.sha256(image).hexdigest()
    if len(image) != SIZE or digest != SOURCE_SHA256:
        raise ValueError("SysCore RX image differs from pinned 14.00 capture")
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
    OUTPUT.write_bytes(synthetic)
    OUTPUT.with_suffix(".json").write_text(
        json.dumps({
            "kind": "analysis-only synthetic ELF",
            "not_original_binary": True,
            "module_name": "libSceSysCore.sprx",
            "memory_range": f"{BASE:#x}-{BASE + SIZE:#x}",
            "memory_bytes_sha256": digest,
            "module_info_ex_capture_id": "eef870320bd243faa4bd06dff102c676",
            "synthetic_sha256": hashlib.sha256(synthetic).hexdigest(),
        }, indent=2) + "\n", encoding="utf-8",
    )
    print(hashlib.sha256(synthetic).hexdigest())


if __name__ == "__main__":
    main()
