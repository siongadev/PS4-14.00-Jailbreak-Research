"""Allowlisted browser actions and the shape of their returned evidence."""

from __future__ import annotations

from .captures import InvalidSubmission

ACTIONS = {
    "runtime_inventory_v1": "Record the availability of five standard browser features",
    "baseline_repeat_v1": "Repeat the two bounded baseline checks",
    "structured_clone_smoke_v1": "Check five ordinary structuredClone behaviors",
    "run_probe_v1": "Run a hash-pinned local probe through the fixed browser runner",
}


def validate_action_checks(action: str, checks: object,
                           expected_probe_checks: list[str] | None = None) -> None:
    if action not in ACTIONS:
        raise InvalidSubmission("unknown action")
    if type(checks) is not list:
        raise InvalidSubmission("action checks must be a list")
    error_id = "probe_error" if action == "run_probe_v1" else "command_error"
    if len(checks) == 1 and type(checks[0]) is dict and checks[0].get("id") == error_id:
        details = checks[0].get("details")
        if checks[0].get("status") != "error" or type(details) is not dict or set(details) != {"error"}:
            raise InvalidSubmission("invalid command error")
        return
    expected = expected_probe_checks if action == "run_probe_v1" else {
        "runtime_inventory_v1": ["runtime_features"],
        "baseline_repeat_v1": ["typed_array_basic", "message_channel_basic"],
        "structured_clone_smoke_v1": [
            "clone_plain_object", "clone_arraybuffer_copy", "clone_arraybuffer_transfer",
            "clone_cycle", "clone_function_rejection",
        ],
    }[action]
    if expected is None:
        raise InvalidSubmission("probe has no declared checks")
    if [check.get("id") if type(check) is dict else None for check in checks] != expected:
        raise InvalidSubmission("checks do not match action")
    if action == "runtime_inventory_v1":
        check = checks[0]
        details = check.get("details")
        if check.get("status") == "pass":
            fields = {"bigint", "webassembly", "shared_array_buffer",
                      "structured_clone", "cross_origin_isolated"}
            if type(details) is not dict or set(details) != fields or any(
                    type(value) is not bool for value in details.values()):
                raise InvalidSubmission("invalid runtime inventory")
        elif check.get("status") != "error" or type(details) is not dict or set(details) != {"error"}:
            raise InvalidSubmission("invalid runtime inventory status")
