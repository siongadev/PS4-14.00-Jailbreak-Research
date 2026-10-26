"""List indirect call sites in one hash-verified live SPRX RX capture."""

from __future__ import annotations

import argparse
from bisect import bisect_right
import hashlib
import json
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_64, Cs


ROOT = Path(__file__).resolve().parent.parent


def scan(manifest_path: Path, handle: int, index_path: Path | None) -> list[dict]:
    report = json.loads(manifest_path.read_text(encoding="utf-8"))
    modules = [module for module in report["modules"] if module["handle"] == handle]
    if len(modules) != 1:
        raise ValueError("module handle missing or ambiguous")
    segment = modules[0]["segments"]["rx"]
    data = (ROOT / segment["file"]).read_bytes()
    if len(data) != segment["size"] or hashlib.sha256(data).hexdigest() != segment["sha256"]:
        raise ValueError("RX image differs from manifest")
    starts: list[int] = []
    if index_path:
        for line in index_path.read_text(encoding="utf-8").splitlines()[1:]:
            address = line.split(" ", 1)[0]
            starts.append(int(address, 16))
        starts.sort()
    decoder = Cs(CS_ARCH_X86, CS_MODE_64)
    rows = []
    for insn in decoder.disasm(data, segment["start"]):
        if insn.mnemonic != "call" or not insn.op_str.startswith("qword ptr ["):
            continue
        idx = bisect_right(starts, insn.address) - 1
        rows.append({
            "address": f"0x{insn.address:x}",
            "module_offset": f"0x{insn.address - segment['start']:x}",
            "function": f"0x{starts[idx]:x}" if idx >= 0 else None,
            "operand": insn.op_str,
        })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--handle", type=lambda value: int(value, 0), required=True)
    parser.add_argument("--index", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = scan(args.manifest, args.handle, args.index)
    args.output.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    print(f"{len(rows)} indirect memory call sites: {args.output}")


if __name__ == "__main__":
    main()
