"""Derive the AvSetting state check from the verified direct-index reader."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "probes" / "clone_history_mbus_state_v2.js"
NEW = ROOT / "probes" / "clone_history_avsetting_state_v1.js"
MANIFEST = ROOT / "probes" / "clone_history_avsetting_state_v1.json"


def main() -> None:
    source = OLD.read_text(encoding="utf-8")
    substitutions = [
        ("Mbus client state after one successful init call", "AvSetting client state after its init attempt"),
        ('x.handle===58&&x.name==="libSceMbus.sprx"', 'x.handle===59&&x.name==="libSceAvSetting.sprx"'),
        ('"mbus_map_missing"', '"avsetting_map_missing"'),
        ('"read_mbus_state"', '"read_avsetting_state"'),
        ('rx.start+0x32c0', 'rx.start+0x3c0'),
        ('0x41,0x55,0x41,0x54,0x53,0x48,0x81,0xec', '0x41,0x54,0x53,0x48,0x81,0xec,0x70,0x01'),
        ('"mbus_entry_changed"', '"avsetting_entry_changed"'),
        ('rw.start+0xb0', 'rw.start+0x60'),
        ('rw.start+0xdc', 'rw.start+0x68'),
        ('"mbus_state_v2"', '"avsetting_state_v1"'),
    ]
    for old, new in substitutions:
        expected = 2 if old == '"mbus_state_v2"' else 1
        if source.count(old) != expected:
            raise ValueError(f"expected {expected} occurrence(s) of {old!r}")
        source = source.replace(old, new)
    if NEW.exists() or MANIFEST.exists():
        raise FileExistsError("AvSetting state probe already exists")
    NEW.write_text(source, encoding="utf-8")
    MANIFEST.write_text(json.dumps({
        "probe_id": "clone_history_avsetting_state_v1",
        "script": NEW.name,
        "check_ids": ["avsetting_state_v1"],
        "timeout_ms": 30000,
    }, indent=2) + "\n", encoding="utf-8")
    print(NEW)


if __name__ == "__main__":
    main()
