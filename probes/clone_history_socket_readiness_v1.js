// Build a source-specific EVFILT_READ control with an owned socketpair.
// Retain a duplicate of the read side, read one event, then close all fds.
var native=window.__fw14NativeInvoke;
var plan=window.__fw14NativePlan;
var result=null,phase="preflight";
var queueFd=-1,readFd=-1,writerFd=-1,dupFd=-1;
var openedPair=null,added=null,written=null,readResult=null;
var eventMatched=false,guardIntact=false;
var cleanupOk=true,bytesRestored=false,registered=false;
var saved=null;
function closeOwned(fd) {
  if (fd<3 || fd>=1024 || !native || typeof native.call!=="function")
    return false;
  try {
    var closed=native.call("close",[fd]);
    return closed.value===0 && closed.high===0;
  } catch (error) { return false; }
}
try {
  if (!native || !plan || typeof native.call!=="function" ||
      native.frame!==plan.frame ||
      native.frameAddress!==plan.addresses.frame ||
      !native.wrappers || !native.wrappers.socketpair ||
      !native.wrappers.dup || !native.wrappers.write ||
      plan.frame.length<0xc00)
    throw new Error("native_socket_caller_missing");
  var frame=plan.frame;
  var view=new DataView(frame.buffer);
  var pairAt=0x700,eventAt=0x800,outputAt=0x900;
  var timeAt=0xa00,byteAt=0xb00;
  var regions=[[pairAt,8],[eventAt,32],[outputAt,64],
               [timeAt,16],[byteAt,1]];
  saved=regions.map(function (region) {
    return Array.from(frame.subarray(region[0],region[0]+region[1]));
  });
  function eventInput(flags) {
    frame.fill(0,eventAt,eventAt+32);
    view.setUint32(eventAt,readFd,true);
    view.setInt16(eventAt+8,-1,true);
    view.setUint16(eventAt+10,flags,true);
    view.setUint32(eventAt+24,0x51515151,true);
  }
  phase="open";
  if (api && typeof api.markSync==="function")
    api.markSync("socket_ready_preflight");
  var queue=native.call("kqueue",[]);
  queueFd=queue.value;
  if (queue.high!==0 || queueFd<3 || queueFd>=1024)
    throw new Error("queue_open_invalid");
  frame.fill(0xa5,pairAt,pairAt+8);
  openedPair=native.call("socketpair",[1,1,0,native.frameAddress+pairAt]);
  if (openedPair.value!==0 || openedPair.high!==0)
    throw new Error("socketpair_failed");
  readFd=view.getInt32(pairAt,true);
  writerFd=view.getInt32(pairAt+4,true);
  if (readFd<3 || readFd>=1024 || writerFd<3 ||
      writerFd>=1024 || writerFd===readFd ||
      readFd===queueFd || writerFd===queueFd)
    throw new Error("socketpair_fds_invalid");
  phase="duplicate";
  var duplicated=native.call("dup",[readFd]);
  dupFd=duplicated.value;
  if (duplicated.high!==0 || dupFd<3 || dupFd>=1024 ||
      dupFd===readFd || dupFd===writerFd || dupFd===queueFd)
    throw new Error("duplicate_fd_invalid");
  phase="register";
  eventInput(1);
  added=native.call("kevent",[queueFd,
    native.frameAddress+eventAt,1,0,0,0]);
  if (added.value!==0 || added.high!==0)
    throw new Error("read_filter_add_failed");
  registered=true;
  phase="write";
  frame[byteAt]=0x7b;
  written=native.call("write",[writerFd,
    native.frameAddress+byteAt,1]);
  if (written.value!==1 || written.high!==0)
    throw new Error("socket_write_failed");
  phase="read_event";
  frame.fill(0xa5,outputAt,outputAt+64);
  frame.fill(0,timeAt,timeAt+16);
  readResult=native.call("kevent",[queueFd,0,0,
    native.frameAddress+outputAt,1,native.frameAddress+timeAt]);
  eventMatched=readResult.value===1 && readResult.high===0 &&
    view.getUint32(outputAt,true)===readFd &&
    view.getUint32(outputAt+4,true)===0 &&
    view.getInt16(outputAt+8,true)===-1;
  guardIntact=true;
  for (var i=32;i<64;i++)
    if (frame[outputAt+i]!==0xa5) guardIntact=false;
  if (!eventMatched || !guardIntact)
    throw new Error("readiness_event_mismatch");
  phase="cleanup";
} catch (error) {
  result={id:"socket_readiness_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,150)}};
} finally {
  if (registered && queueFd>=3) {
    try {
      frame.fill(0,0x800,0x820);
      var eventView=new DataView(frame.buffer);
      eventView.setUint32(0x800,readFd,true);
      eventView.setInt16(0x808,-1,true);
      eventView.setUint16(0x80a,2,true);
      var deleted=native.call("kevent",[queueFd,
        native.frameAddress+0x800,1,0,0,0]);
      cleanupOk=cleanupOk && deleted.value===0 && deleted.high===0;
    } catch (error) { cleanupOk=false; }
  }
  if (dupFd>=3) cleanupOk=closeOwned(dupFd) && cleanupOk;
  if (writerFd>=3) cleanupOk=closeOwned(writerFd) && cleanupOk;
  if (readFd>=3) cleanupOk=closeOwned(readFd) && cleanupOk;
  if (queueFd>=3) cleanupOk=closeOwned(queueFd) && cleanupOk;
  if (!cleanupOk)
    window.__fw14SocketCleanup={queue:queueFd,read:readFd,
      writer:writerFd,duplicate:dupFd};
  if (saved && plan && plan.frame) {
    bytesRestored=true;
    for (var ri=0;ri<regions.length;ri++) {
      var region=regions[ri];
      for (var bi=0;bi<region[1];bi++)
        frame[region[0]+bi]=saved[ri][bi];
      for (var ci=0;ci<region[1];ci++)
        if (frame[region[0]+ci]!==saved[ri][ci])
          bytesRestored=false;
    }
  }
}
if (!result)
  result={id:"socket_readiness_v1",
    status:openedPair && added && written && readResult &&
      eventMatched && guardIntact && cleanupOk && bytesRestored ?
      "pass":"fail",
    details:{queue_fd:queueFd,read_fd:readFd,
      writer_fd:writerFd,dup_fd:dupFd,
      socketpair_return:openedPair ? openedPair.value:null,
      add_return:added ? added.value:null,
      write_return:written ? written.value:null,
      event_return:readResult ? readResult.value:null,
      event_matched:eventMatched,guard_intact:guardIntact,
      cleanup_ok:cleanupOk,bytes_restored:bytesRestored}};
else {
  result.details.cleanup_ok=cleanupOk;
  result.details.bytes_restored=bytesRestored;
}
if (cleanupOk && bytesRestored && api &&
    typeof api.markSync==="function")
  api.markSync("socket_ready_restored");
return [result];
