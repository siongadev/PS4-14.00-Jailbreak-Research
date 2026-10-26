"""Build a checked caller for two additional 14.00 NetCtl output methods."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "probes" / "clone_history_native_invoke_install_v39.js"
NEW = ROOT / "probes" / "clone_history_native_invoke_install_v45.js"
OLD_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v39.json"
NEW_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v45.json"


def main() -> None:
    source = OLD.read_text(encoding="utf-8")
    anchor = ("  wrappers.netctl_output4=[netctlRx.start+0x3200,"
              "[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x49,0x89,0xfe,0x48,0x8d,0x3d,0x4f,0x8e,0x00]];")
    extra = ("\n  wrappers.netctl_output56=[netctlRx.start+0x34f0,"
             "[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x49,0x89,0xfe,0x48,0x8d,0x3d,0x5f,0x8b,0x00]];"
             "\n  wrappers.netctl_output28=[netctlRx.start+0x5490,"
             "[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x49,0x89,0xfe,0x48,0x8d,0x3d,0xbf,0x6b,0x00]];")
    if source.count(anchor) != 1:
        raise ValueError("NetCtl anchor changed")
    source = source.replace(anchor, anchor + extra)
    old_export = "netctl_output4:wrappers.netctl_output4[0] },"
    new_export = ("netctl_output4:wrappers.netctl_output4[0],"
                  "netctl_output56:wrappers.netctl_output56[0],"
                  "netctl_output28:wrappers.netctl_output28[0] },")
    if source.count(old_export) != 1:
        raise ValueError("NetCtl export anchor changed")
    source = source.replace(old_export, new_export).replace("v39", "v45")
    # Leading indentation is insignificant here (no template literals).
    source = "\n".join(line.lstrip() for line in source.splitlines()) + "\n"
    if NEW.exists() or NEW_MANIFEST.exists():
        raise FileExistsError("v45 probe already exists")
    encoded = source.encode("utf-8")
    if len(encoded) > 32768:
        raise ValueError(f"source exceeds collector cap: {len(encoded)}")
    NEW.write_bytes(encoded)
    NEW_MANIFEST.write_text(
        OLD_MANIFEST.read_text(encoding="utf-8").replace("v39", "v45"),
        encoding="utf-8",
    )
    print(f"{NEW} {len(encoded)} bytes")


if __name__ == "__main__":
    main()
