#!/usr/bin/env python3
"""Verify the preserved 14.00 SysCore mode gate and its client pointer."""

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RX_PATH = ROOT / "evidence/live/rx_0x81b340000_14.00.bin"
RW_PATH = ROOT / "evidence/live/rw_0x818f10000_14.00.bin"
RX_SHA256 = "c45cb886410dcb33b3f63d0db1632a5f0f02c765ed6ad8b37a192b9b151027c7"
RW_SHA256 = "91b4101ded386a8c37c6c804758c9957f2c6e5d24b1050f9fa19d8fbaa1f485e"


def read_checked(path, expected):
    data = path.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise ValueError(f"{path.name}: unexpected SHA-256 {actual}")
    return data


def main():
    rx = read_checked(RX_PATH, RX_SHA256)
    rw = read_checked(RW_PATH, RW_SHA256)
    # RX+0x6f6: mov rdi, qword ptr [rip+0xb963].
    insn = rx[0x6F6:0x6FD]
    if insn[:3] != bytes.fromhex("48 8b 3d"):
        raise ValueError("RX+0x6f6 is not the expected RIP-relative load")
    displacement = int.from_bytes(insn[3:7], "little", signed=True)
    client_offset = 0x6FD + displacement
    # RX+0x737: call RX+0x2e10. Within that callee, RX+0x2f12
    # dereferences the client pointer previously passed in RDI.
    if rx[0x737:0x73C] != bytes.fromhex("e8 d4 26 00 00"):
        raise ValueError("RX+0x737 call target changed")
    if rx[0x2F12:0x2F15] != bytes.fromhex("49 8b 07"):
        raise ValueError("RX+0x2f12 client dereference changed")
    if client_offset != 0xC060:
        raise ValueError(f"unexpected client offset {client_offset:#x}")
    client = int.from_bytes(rw[client_offset - 0xC000:client_offset - 0xC000 + 8], "little")
    print(json.dumps({
        "rx_sha256": RX_SHA256,
        "rw_sha256": RW_SHA256,
        "mode_guard_init": rw[0x88],
        "mode_guard_app": rw[0x89],
        "client_offset": hex(client_offset),
        "client_pointer": hex(client),
        "dispatch_call_offset": "0x737",
        "callee_dereference_offset": "0x2f12",
    }, indent=2))


if __name__ == "__main__":
    main()
