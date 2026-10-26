"""Build a matched 14.00 current-app versus focused-app status query."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def main() -> None:
    source = (PROBES / "clone_history_lnc_raw_status_v1.js").read_text(
        encoding="utf-8"
    )
    if source.count("0x30013") != 1:
        raise ValueError("status method template changed")
    source = source.replace("0x30013", "0x30020")
    source = source.replace(
        'raw.value===0&&sysResult===0&&methodResult===0&&rawHex===officialHex?',
        'raw.value===0&&raw.high===0&&sysResult===0&&methodResult===0?',
    )
    if source.count('id:"lnc_raw_status_v1"') != 2:
        raise ValueError("status check template changed")
    source = source.replace("lnc_raw_status_v1", "lnc_focused_status_v1")
    source = source.replace(
        "// Query the already-initialized VideoCore IPMI client's peer PID. No\n"
        "// connection, method, disconnect, or destroy is sent to the live client.",
        "// Compare the current-app status with the focused-app status.\n"
        "// The existing SystemService client is neither closed nor changed.",
    )
    (PROBES / "clone_history_lnc_focused_status_v1.js").write_text(
        source, encoding="utf-8"
    )
    manifest = {
        "probe_id": "clone_history_lnc_focused_status_v1",
        "script": "clone_history_lnc_focused_status_v1.js",
        "check_ids": ["lnc_focused_status_v1"],
        "timeout_ms": 30000,
    }
    (PROBES / "clone_history_lnc_focused_status_v1.json").write_text(
        json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
