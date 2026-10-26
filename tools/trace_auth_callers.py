"""Trace direct calls to the verified 587/607 import thunks in live 14.00 images.

The report is a static caller index, not proof that a callsite executed.
Only RX data whose SHA-256 matches the live capture manifest is decoded.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_64, Cs


ROOT = Path(__file__).resolve().parent.parent
SESSION = "2119cf8f1a734dc5a6b964e8c2b1d3fb"
BASE = ROOT / "evidence" / "live" / "full_sprx" / SESSION
TARGETS = {587, 607}


def main() -> None:
    manifest = json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))
    imports = json.loads((BASE / "module_syscall_imports.json").read_text(encoding="utf-8"))
    modules = {module["handle"]: module for module in manifest["modules"]}
    decoder = Cs(CS_ARCH_X86, CS_MODE_64)
    rows: list[dict] = []
    for entry in imports["modules"]:
        links = [link for link in entry["links"] if link["number"] in TARGETS]
        if not links:
            continue
        rx = modules[entry["handle"]]["segments"]["rx"]
        data = (ROOT / rx["file"]).read_bytes()
        if len(data) != rx["size"] or hashlib.sha256(data).hexdigest() != rx["sha256"]:
            raise ValueError(f"RX capture mismatch: {entry['name']}")
        target_by_address = {
            rx["start"] + link["source_offset"]: link["number"] for link in links
        }
        instructions = list(decoder.disasm(data, rx["start"]))
        def render(instruction):
            return (f"+0x{instruction.address - rx['start']:x}: "
                    f"{instruction.mnemonic} {instruction.op_str}")
        for index, instruction in enumerate(instructions):
            if instruction.mnemonic == "call":
                try:
                    target = int(instruction.op_str, 0)
                except ValueError:
                    target = None
                if target in target_by_address:
                    rows.append({
                        "module": entry["name"],
                        "number": target_by_address[target],
                        "call_offset": instruction.address - rx["start"],
                        "thunk_offset": target - rx["start"],
                        "preceding_instructions": [
                            render(item) for item in instructions[max(0, index - 10):index]
                        ],
                        "following_instructions": [
                            render(item) for item in instructions[index + 1:index + 9]
                        ],
                    })
    output = BASE / "analysis_elf" / "auth_syscall_callers.json"
    output.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"caller_count": len(rows), "output": str(output)}, indent=2))


if __name__ == "__main__":
    main()
