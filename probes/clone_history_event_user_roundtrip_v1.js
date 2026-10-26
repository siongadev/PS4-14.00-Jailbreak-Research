// 14.00 event-queue user-filter control with bounded output and descriptor cleanup.
var native = window.__fw14NativeInvoke;
var plan = window.__fw14NativePlan;
var result;
var phase = "preflight";
var fd = -1;
var closeResult = null;
var closeError = null;
var restored = false;
var registered = false;
var added = null, triggered = null, readResult = null, deleted = null;
var eventMatched = false, guardIntact = false;
var saved = null;
try {
  if (!native || !plan || typeof native.call !== "function" ||
      native.frame !== plan.frame ||
      native.frameAddress !== plan.addresses.frame ||
      !native.wrappers || !native.wrappers.kevent ||
      plan.frame.length < 0x700)
    throw new Error("page_native_caller_missing");
  var frame = plan.frame;
  var view = new DataView(frame.buffer);
  var eventOffset = 0x400;
  var outputOffset = 0x500;
  var timeoutOffset = 0x600;
  var savedEvent = Array.from(frame.subarray(eventOffset,eventOffset+32));
  var savedOutput = Array.from(frame.subarray(outputOffset,outputOffset+64));
  var savedTimeout = Array.from(frame.subarray(timeoutOffset,timeoutOffset+16));
  saved = [savedEvent,savedOutput,savedTimeout];
  function eventInput(flags,fflags) {
    frame.fill(0,eventOffset,eventOffset+32);
    view.setUint32(eventOffset,1,true);
    view.setInt16(eventOffset+8,-11,true);
    view.setUint16(eventOffset+10,flags,true);
    view.setUint32(eventOffset+12,fflags,true);
    view.setUint32(eventOffset+24,0x42424242,true);
  }
  function callEvent(changes,eventlist,nevents,timeout) {
    return native.call("kevent",[fd,changes,changes ? 1 : 0,
                                 eventlist,nevents,timeout]);
  }
  if (api && typeof api.markSync === "function")
    api.markSync("user_queue_preflight");
  phase = "open";
  var opened = native.call("kqueue",[]);
  fd = opened.value;
  if (opened.high !== 0 || fd < 3 || fd >= 1024)
    throw new Error("queue_open_invalid");
  phase = "add";
  eventInput(1,0);
  added = callEvent(native.frameAddress+eventOffset,0,0,0);
  if (added.value !== 0 || added.high !== 0)
    throw new Error("user_event_add_failed");
  registered = true;
  phase = "trigger";
  eventInput(0,0x01000000);
  triggered = callEvent(native.frameAddress+eventOffset,0,0,0);
  if (triggered.value !== 0 || triggered.high !== 0)
    throw new Error("user_event_trigger_failed");
  phase = "read";
  frame.fill(0xa5,outputOffset,outputOffset+64);
  frame.fill(0,timeoutOffset,timeoutOffset+16);
  readResult = callEvent(0,native.frameAddress+outputOffset,
                         1,native.frameAddress+timeoutOffset);
  eventMatched = readResult.value === 1 && readResult.high === 0 &&
    view.getUint32(outputOffset,true) === 1 &&
    view.getUint32(outputOffset+4,true) === 0 &&
    view.getInt16(outputOffset+8,true) === -11;
  guardIntact = true;
  for (var gi=32;gi<64;gi++)
    if (frame[outputOffset+gi] !== 0xa5) guardIntact = false;
  if (!eventMatched || !guardIntact)
    throw new Error("user_event_output_mismatch");
  phase = "delete";
  eventInput(2,0);
  deleted = callEvent(native.frameAddress+eventOffset,0,0,0);
  if (deleted.value !== 0 || deleted.high !== 0)
    throw new Error("user_event_delete_failed");
  registered = false;
  phase = "cleanup";
} catch (error) {
  result = {id:"event_user_roundtrip_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
} finally {
  if (fd >= 3 && fd < 1024) {
    if (registered) {
      try {
        var cleanupView = new DataView(plan.frame.buffer);
        plan.frame.fill(0,0x400,0x420);
        cleanupView.setUint32(0x400,1,true);
        cleanupView.setInt16(0x408,-11,true);
        cleanupView.setUint16(0x40a,2,true);
        native.call("kevent",[fd,native.frameAddress+0x400,1,0,0,0]);
      } catch (error) {
        closeError = "delete:"+String(error).slice(0,100);
      }
    }
    try { closeResult = native.call("close",[fd]); }
    catch (error) {
      closeError = (closeError ? closeError+";" : "")+
        "close:"+String(error).slice(0,100);
    }
    if (!closeResult || closeResult.value !== 0 || closeResult.high !== 0)
      window.__fw14QueueFd = fd;
  }
  if (saved && plan && plan.frame) {
    for (var i=0;i<32;i++) plan.frame[0x400+i]=saved[0][i];
    for (var j=0;j<64;j++) plan.frame[0x500+j]=saved[1][j];
    for (var k=0;k<16;k++) plan.frame[0x600+k]=saved[2][k];
    restored = true;
    for (var x=0;x<32;x++)
      if (plan.frame[0x400+x]!==saved[0][x]) restored=false;
    for (var y=0;y<64;y++)
      if (plan.frame[0x500+y]!==saved[1][y]) restored=false;
    for (var z=0;z<16;z++)
      if (plan.frame[0x600+z]!==saved[2][z]) restored=false;
  }
}
if (!result)
  result={id:"event_user_roundtrip_v1",
    status:fd>=3 && added && triggered && readResult && deleted &&
      eventMatched && guardIntact && restored && closeResult &&
      closeResult.value===0 && closeResult.high===0 && !closeError ?
      "pass":"fail",
    details:{fd:fd,add_return:added ? added.value : null,
      trigger_return:triggered ? triggered.value : null,
      read_return:readResult ? readResult.value : null,
      event_matched:eventMatched,guard_intact:guardIntact,
      delete_return:deleted ? deleted.value : null,
      close_return:closeResult ? closeResult.value : null,
      close_error:closeError,owned_bytes_restored:restored}};
else {
  result.details.close_return=closeResult ? closeResult.value : null;
  result.details.close_error=closeError;
  result.details.owned_bytes_restored=restored;
}
if (restored && closeResult && closeResult.value===0 &&
    api && typeof api.markSync === "function")
  api.markSync("user_queue_restored");
return [result];
