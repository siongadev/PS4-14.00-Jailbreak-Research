"""Correlate 14.00 LNC method wrappers with their decompiled caller strings."""

from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb"


def main() -> None:
    mapping = json.loads((BASE / "lnc_request_map.json").read_text(encoding="utf-8"))
    source = (BASE / "analysis_elf/lnc_client_callers_range.txt").read_text(
        encoding="utf-8"
    )
    front = (BASE / "analysis_elf/lnc_request_range.txt").read_text(
        encoding="utf-8"
    )
    source += front.split("=== 807734130", 1)[0]
    sections = re.split(r"(?=^=== [0-9a-f]+ body=)", source, flags=re.M)
    excluded = {
        "status", "path", "param", "initialize", "length", "isValid",
        "titleId", "LNC_ISOK", "LNC_CHECK", "SceLncUtil",
    }
    matched = 0
    for request in mapping["requests"]:
        function = request["function_address"][2:]
        callers = [section for section in sections
                   if re.search(r"\bFUN_" + function + r"\(", section)]
        names: Counter[str] = Counter()
        for section in callers:
            for value in re.findall(r'"([A-Za-z][A-Za-z0-9_]{2,})"', section):
                if value not in excluded and (value[0].islower() or value.startswith("sce")):
                    names[value] += 1
        request["caller_count_in_range"] = len(callers)
        request["caller_name_candidates"] = [
            {"name": name, "occurrences": count}
            for name, count in names.most_common(3)
        ]
        if callers:
            matched += 1
    output = BASE / "lnc_request_map_annotated.json"
    output.write_text(json.dumps(mapping, indent=2) + "\n", encoding="utf-8")
    print(output, "matched", matched, "of", mapping["count"])
    for request in mapping["requests"]:
        if request["caller_name_candidates"]:
            print(request["method_id"], request["caller_name_candidates"][:2])


if __name__ == "__main__":
    main()
