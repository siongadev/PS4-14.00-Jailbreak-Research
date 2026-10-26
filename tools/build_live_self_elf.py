"""Wrap the measured 14.00 RX bytes in a minimal analysis-only ELF.

This is not a decrypted Sony SELF or an original executable file. The one
PT_LOAD segment contains exactly the 32 KiB captured from the live process.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct

from fw14lab.verify import verify_capture


ROOT = Path(__file__).resolve().parent.parent
IMAGE = ROOT / "evidence" / "live" / "rx_0x1730000_14.00.bin"
ELF = ROOT / "evidence" / "live" / "rx_0x1730000_14.00.synthetic.elf"
SELF_CAPTURE = ROOT / "captures" / "38e302faf1164da082a6203b02e487e2.json"


def main() -> None:
    image = IMAGE.read_bytes()
    if len(image) != 0x8000 or image[:8] != b"/libexec":
        raise ValueError("live mapping size or prefix changed")
    record = verify_capture(SELF_CAPTURE)
    details = record["submission"]["checks"][0]["details"]
    if record["submission"]["checks"][0]["status"] != "pass":
        raise ValueError("on-disk header capture did not pass")
    prefix = bytes.fromhex("".join(details[f"chunk_{i}"] for i in range(4)))
    original_elf = prefix[288:]
    ehdr = struct.unpack_from("<16sHHIQQQIHHHHHH", original_elf)
    phdr = struct.unpack_from("<IIQQQQQQ", original_elf, ehdr[5])
    if (ehdr[0][:4] != b"\x7fELF" or ehdr[2] != 62 or
            ehdr[4] != 0x4730 or phdr[0] != 1 or phdr[2] != 0x4000 or
            phdr[3] != 0 or phdr[5] != 0x6EF8 or phdr[6] != 0x6EF8):
        raise ValueError("SELF ELF header differs from measured map hypothesis")
    ident = b"\x7fELF" + bytes([2, 1, 1, 0]) + bytes(8)
    header = struct.pack(
        "<16sHHIQQQIHHHHHH", ident, 2, 62, 1,
        0x1734730, 64, 0, 0, 64, 56, 1, 0, 0, 0,
    )
    segment = struct.pack(
        "<IIQQQQQQ", 1, 5, 0x1000, 0x1730000, 0x1730000,
        len(image), len(image), 0x1000,
    )
    synthetic = header + segment
    synthetic += bytes(0x1000 - len(synthetic)) + image
    ELF.write_bytes(synthetic)
    metadata = {
        "kind": "analysis-only synthetic ELF",
        "not_original_binary": True,
        "memory_bytes_path": str(IMAGE),
        "memory_bytes_sha256": hashlib.sha256(image).hexdigest(),
        "memory_range": "0x1730000-0x1738000",
        "original_self_header_capture": record["capture_id"],
        "module_name_capture_id": "0088271122ef48d8aad68e45d43e6e8b",
        "original_self_entry_offset": "0x4730",
        "synthetic_pt_load_file_offset": "0x1000",
        "synthetic_sha256": hashlib.sha256(synthetic).hexdigest(),
    }
    ELF.with_suffix(".json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
