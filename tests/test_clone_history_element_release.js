const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function load(name) {
    const source = fs.readFileSync(path.join(__dirname, "..", "probes", name), "utf8");
    return new Function("api", "window", source);
}

function fixture() {
    const firstBytes = [0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18];
    const secondBytes = [0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28];
    const view = Uint8Array.from(firstBytes.concat(secondBytes));
    const first = { nodeName: "SPAN", nodeType: 1 };
    const second = { nodeName: "SPAN", nodeType: 1, id: "" };
    const parent = { removeChild(node) { node.parentNode = null; } };
    second.parentNode = parent;
    const list = {
        length: 8191,
        item(index) {
            if (index === 1) return second;
            if (index !== 0) return null;
            return view[0] === firstBytes[0] ? first : second;
        },
    };
    const win = { __fw14NodeState: {
        list, firstNode: first, view, index: 0, elementBytes: firstBytes,
    } };
    const phases = [];
    return { win, view, firstBytes, secondBytes, second, phases,
        api: { markSync(name) { phases.push(name); } } };
}

const control = fixture();
const controlResult = load("clone_history_element_release_control_v1.js")(
    control.api, control.win)[0];
assert.equal(controlResult.status, "pass");
assert.equal(control.win.__fw14NodeState, null);
assert.equal(control.win.__fw14ElementState.mode, "element-control");
assert.deepEqual(Array.from(control.view.slice(0, 8)), control.firstBytes);
assert.equal(control.second.parentNode, null);

const mutated = fixture();
const mutatedResult = load("clone_history_element_release_mutated_v1.js")(
    mutated.api, mutated.win)[0];
assert.equal(mutatedResult.status, "pass");
assert.equal(mutatedResult.details.duplicated, true);
assert.equal(mutated.win.__fw14NodeState, null);
assert.equal(mutated.win.__fw14ElementState.mode, "element-mutated");
assert.deepEqual(Array.from(mutated.view.slice(0, 8)), mutated.secondBytes);
assert.deepEqual(mutated.phases, ["element_before_write", "element_before_release"]);

console.log("Element release control preserves bytes; mutation duplicates the live entry");
