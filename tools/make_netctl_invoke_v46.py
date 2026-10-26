"""Add the four remaining output-only NetCtl 14.00 methods."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "probes" / "clone_history_native_invoke_install_v45.js"
NEW = ROOT / "probes" / "clone_history_native_invoke_install_v46.js"
OLD_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v45.json"
NEW_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v46.json"


def main() -> None:
    source = OLD.read_text(encoding="utf-8")
    anchor = ("wrappers.netctl_output28=[netctlRx.start+0x5490,"
              "[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x49,0x89,0xfe,0x48,0x8d,0x3d,0xbf,0x6b,0x00]];")
    entries = [
        ("netctl_m07", 0x3550, 0xFF, 0x8A),
        ("netctl_m08", 0x35B0, 0x9F, 0x8A),
        ("netctl_m09", 0x3300, 0x4F, 0x8D),
        ("netctl_m17", 0x3F80, 0xCF, 0x80),
    ]
    extra = "".join(
        f"\nwrappers.{name}=[netctlRx.start+0x{offset:x},"
        f"[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x49,0x89,0xfe,0x48,0x8d,0x3d,0x{lo:02x},0x{hi:02x},0x00]];"
        for name, offset, lo, hi in entries
    )
    if source.count(anchor) != 1:
        raise ValueError("NetCtl output28 anchor changed")
    source = source.replace(anchor, anchor + extra)
    old_export = "netctl_output28:wrappers.netctl_output28[0] },"
    new_export = "netctl_output28:wrappers.netctl_output28[0]," + \
        ",".join(f"{name}:wrappers.{name}[0]" for name, *_ in entries) + " },"
    if source.count(old_export) != 1:
        raise ValueError("NetCtl export anchor changed")
    source = source.replace(old_export, new_export).replace("v45", "v46")
    if NEW.exists() or NEW_MANIFEST.exists():
        raise FileExistsError("v46 probe already exists")
    encoded = source.encode("utf-8")
    if len(encoded) > 32768:
        raise ValueError(f"source exceeds collector cap: {len(encoded)}")
    NEW.write_bytes(encoded)
    NEW_MANIFEST.write_text(
        OLD_MANIFEST.read_text(encoding="utf-8").replace("v45", "v46"),
        encoding="utf-8",
    )
    print(f"{NEW} {len(encoded)} bytes")


if __name__ == "__main__":
    main()
