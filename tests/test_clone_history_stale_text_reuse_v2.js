const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "probes",
    "clone_history_stale_text_reuse_v2.js"), "utf8");
const run = new Function("api", "window", "document", source);

function scenario(reuseIndex) {
    const shared = { value: "text-probe" };
    const stale = { nodeType: 3 };
    Object.defineProperty(stale, "data", {
        get() { return shared.value; },
        set(value) { shared.value = value; },
    });
    const win = { __fw14RefcountState: {
        mode: "mutated", textNode: stale, events: ["list"],
    } };
    const phases = [];
    let created = 0;
    const doc = {
        createDocumentFragment() { return { appendChild() {} }; },
        createTextNode(value) {
            const index = created++;
            if (index === reuseIndex) {
                shared.value = value;
                const alias = {};
                Object.defineProperty(alias, "data", {
                    get() { return shared.value; },
                    set(next) { shared.value = next; },
                });
                return alias;
            }
            return { data: value };
        },
    };
    return { check: run({ markSync(name) { phases.push(name); } }, win, doc)[0],
        phases, win, shared };
}

const miss = scenario(-1);
assert.equal(miss.check.status, "pass");
assert.equal(miss.check.details.alias_index, -1);
assert.equal(miss.check.details.write_attempted, false);
assert.equal(miss.check.details.live_changed, false);
assert.equal(miss.shared.value, "text-probe");

const hit = scenario(7);
assert.equal(hit.check.status, "pass");
assert.equal(hit.check.details.alias_index, 7);
assert.equal(hit.check.details.alias_wrapper_same, false);
assert.equal(hit.check.details.write_attempted, true);
assert.equal(hit.check.details.live_changed, true);
assert.equal(hit.check.details.restored, true);
assert.equal(hit.shared.value, "fw14-reuse-v2-7-unique");
assert.deepEqual(hit.phases, ["stale_text_before_read", "stale_text_alias_7",
    "stale_text_before_write", "stale_text_after_write",
    "stale_text_after_restore"]);

console.log("stale Text reuse probe gates and restores the matched alias");
