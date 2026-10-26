"""Hash-check each captured RX image and inventory x86-64 syscall bytes."""

import argparse
import hashlib
import json
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_64


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    decoder = Cs(CS_ARCH_X86, CS_MODE_64)
    modules = []
    total = 0
    for module in manifest["modules"]:
        rx = module["segments"]["rx"]
        file = ROOT / rx["file"]
        blob = file.read_bytes()
        if len(blob) != rx["size"] or hashlib.sha256(blob).hexdigest() != rx["sha256"]:
            raise ValueError(f"RX image failed manifest check: {module['name']}")
        sites = []
        pos = 0
        while (pos := blob.find(b"\x0f\x05", pos)) >= 0:
            base = rx["start"] + pos
            forward = [f"{i.mnemonic} {i.op_str}".strip()
                       for i in decoder.disasm(blob[pos:pos + 18], base, count=4)]
            sites.append({
                "rx_offset": pos,
                "preceding_hex": blob[max(0, pos - 24):pos].hex(),
                "following_hex": blob[pos + 2:pos + 18].hex(),
                "forward_disassembly": forward,
            })
            pos += 2
        modules.append({
            "handle": module["handle"],
            "name": module["name"],
            "rx_sha256": rx["sha256"],
            "rx_bytes": len(blob),
            "syscall_byte_sites": sites,
        })
        total += len(sites)
    output = {
        "firmware_label": manifest["firmware_label"],
        "session_id": manifest["session_id"],
        "scope": "literal 0f05 byte pairs in hash-checked RX mappings; disassembly validation is separate",
        "module_count": len(modules),
        "site_count": total,
        "modules": modules,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"modules": len(modules), "sites": total,
                      "nonzero": [{"handle": m["handle"], "name": m["name"],
                                   "count": len(m["syscall_byte_sites"])}
                                  for m in modules if m["syscall_byte_sites"]]}, indent=2))


if __name__ == "__main__":
    main()
