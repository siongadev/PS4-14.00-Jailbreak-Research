"""Extend the checked native caller with the 14.00 AvSetting initializer."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "probes" / "clone_history_native_invoke_install_v42.js"
NEW = ROOT / "probes" / "clone_history_native_invoke_install_v43.js"
OLD_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v42.json"
NEW_MANIFEST = ROOT / "probes" / "clone_history_native_invoke_install_v43.json"


def main() -> None:
    source = OLD.read_text(encoding="utf-8")
    anchor = ("  wrappers.mbus_query=[mbusRx.start+0x2190,"
              "[0x55,0x48,0x89,0xe5,0x53,0x48,0x83,0xec,"
              "0x38,0x48,0x8b,0x1d,0x88,0x9e,0x00,0x00]];")
    addition = ("\n  var av=liveMap.modules.filter(function(x){return x.handle===59&&x.name===\"libSceAvSetting.sprx\";})[0];"
                "\n  var avRx=av&&av.segments.filter(function(x){return x.kind===\"rx\"&&x.size===49152;})[0];"
                "\n  if(!avRx)throw new Error(\"avsetting_map_missing\");"
                "\n  wrappers.av_init=[avRx.start+0x3c0,"
                "[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,"
                "0x41,0x54,0x53,0x48,0x81,0xec,0x70,0x01]];")
    if source.count(anchor) != 1:
        raise ValueError("Mbus query anchor changed")
    source = source.replace(anchor, anchor + addition)
    old_export = "mbus_query:wrappers.mbus_query[0] },"
    new_export = "mbus_query:wrappers.mbus_query[0],av_init:wrappers.av_init[0] },"
    if source.count(old_export) != 1:
        raise ValueError("Mbus export anchor changed")
    source = source.replace(old_export, new_export).replace("v42", "v43")
    if NEW.exists() or NEW_MANIFEST.exists():
        raise FileExistsError("v43 probe already exists")
    encoded = source.encode("utf-8")
    if len(encoded) > 32768:
        raise ValueError(f"source exceeds collector cap: {len(encoded)}")
    NEW.write_bytes(encoded)
    NEW_MANIFEST.write_text(
        OLD_MANIFEST.read_text(encoding="utf-8").replace("v42", "v43"),
        encoding="utf-8",
    )
    print(f"{NEW} {len(encoded)} bytes")


if __name__ == "__main__":
    main()
