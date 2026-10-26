"""Find direct RIP-relative references to an ASCII string in a captured RX map.

This is an analysis aid. Linear decoding can miss paths or decode embedded
data as instructions; validate candidates in a disassembler before use.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_64, Cs
from capstone.x86_const import X86_OP_MEM, X86_REG_RIP


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--handle", type=int, required=True)
    parser.add_argument("--text", required=True)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    module = next(m for m in manifest["modules"] if m["handle"] == args.handle)
    segment = module["segments"]["rx"]
    image = Path(segment["file"])
    if not image.is_absolute():
        image = args.manifest.parents[4] / image
    data = image.read_bytes()
    needle = args.text.encode("ascii")
    positions = [i for i in range(len(data)) if data.startswith(needle, i)]
    starts = {segment["start"] + position for position in positions}
    disassembler = Cs(CS_ARCH_X86, CS_MODE_64)
    disassembler.detail = True
    references = []
    for insn in disassembler.disasm(data, segment["start"]):
        for operand in insn.operands:
            if operand.type == X86_OP_MEM and operand.mem.base == X86_REG_RIP:
                target = insn.address + insn.size + operand.mem.disp
                if target in starts:
                    references.append(
                        {"address": hex(insn.address), "target": hex(target),
                         "instruction": f"{insn.mnemonic} {insn.op_str}"}
                    )
    print(json.dumps({"module": module["name"], "handle": args.handle,
                      "string": args.text, "string_offsets": [hex(p) for p in positions],
                      "references": references}, indent=2))


if __name__ == "__main__":
    main()
