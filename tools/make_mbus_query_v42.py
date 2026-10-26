"""Extend the pinned v41 caller with one source-defined Mbus output query."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "probes" / "clone_history_native_invoke_install_v41.js"
NEW = ROOT / "probes" / "clone_history_native_invoke_install_v42.js"
OLD_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v41.json"
NEW_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v42.json"


def main() -> None:
    text = OLD.read_text(encoding="utf-8")
    anchor = ("  wrappers.mbus_init=[mbusRx.start+0x32c0,"
              "[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,"
              "0x41,0x55,0x41,0x54,0x53,0x48,0x81,0xec]];")
    addition = ("\n  wrappers.mbus_query=[mbusRx.start+0x2190,"
                "[0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,"
                "0x38,0x48,0x8b,0x1d,0x88,0x9e,0x00,0x00]];")
    if text.count(anchor) != 1:
        raise ValueError("Mbus initializer anchor changed")
    text = text.replace(anchor, anchor + addition)
    old_export = "mbus_init:wrappers.mbus_init[0] },"
    new_export = "mbus_init:wrappers.mbus_init[0],mbus_query:wrappers.mbus_query[0] },"
    if text.count(old_export) != 1:
        raise ValueError("Mbus export anchor changed")
    text = text.replace(old_export, new_export).replace("v41", "v42")
    if NEW.exists() or NEW_MANIFEST.exists():
        raise FileExistsError("v42 probe already exists")
    # LF is intentional: it stays below the collector's 32 KiB source cap.
    NEW.write_bytes(text.encode("utf-8"))
    manifest = OLD_MANIFEST.read_text(encoding="utf-8").replace("v41", "v42")
    NEW_MANIFEST.write_bytes(manifest.encode("utf-8"))
    print(NEW)
    print(NEW_MANIFEST)


if __name__ == "__main__":
    main()
