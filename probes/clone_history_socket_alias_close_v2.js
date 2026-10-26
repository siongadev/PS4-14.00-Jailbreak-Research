// Check descriptor-specific EVFILT_READ removal while a duplicate keeps
// the old socket alive. This is sequential; it does not attempt a race.
var native=window.__fw14NativeInvoke,plan=window.__fw14NativePlan;
var phase="preflight",result=null,queueFd=-1,readFd=-1;
var originalReadFd=-1;
var writerFd=-1,dupFd=-1,registered=-1;
var addOld=null,closeOld=null,emptyRead=null,addDup=null;
var writeResult=null,dupRead=null,deleteDup=null;
var emptyGuard=true,dupGuard=true,eventMatched=false;
var cleanupOk=true,bytesRestored=false,saved=null;
var frame=null,view=null,regions=null;
function closeFd(fd) {
  if (fd<3 || fd>=1024 || !native || typeof native.call!=="function")
    return false;
  try {
    var ret=native.call("close",[fd]);
    return ret.value===0 && ret.high===0;
  } catch (error) { return false; }
}
function eventFor(fd,flags) {
  frame.fill(0,0x800,0x820);
  view.setUint32(0x800,fd,true);
  view.setInt16(0x808,-1,true);
  view.setUint16(0x80a,flags,true);
  view.setUint32(0x818,0x51515151,true);
}
function readReady() {
  frame.fill(0xa5,0x900,0x940);
  frame.fill(0,0xa00,0xa10);
  return native.call("kevent",[queueFd,0,0,
    native.frameAddress+0x900,1,native.frameAddress+0xa00]);
}
try {
  if (!native || !plan || typeof native.call!=="function" ||
      native.frame!==plan.frame ||
      native.frameAddress!==plan.addresses.frame ||
      !native.wrappers || !native.wrappers.socketpair ||
      !native.wrappers.dup || !native.wrappers.write ||
      plan.frame.length<0xc00)
    throw new Error("native_socket_caller_missing");
  frame=plan.frame; view=new DataView(frame.buffer);
  regions=[[0x700,8],[0x800,32],[0x900,64],
           [0xa00,16],[0xb00,1]];
  saved=regions.map(function (r) {
    return Array.from(frame.subarray(r[0],r[0]+r[1]));
  });
  if (api && typeof api.markSync==="function")
    api.markSync("socket_alias_preflight");
  phase="open";
  var queue=native.call("kqueue",[]);
  queueFd=queue.value;
  if (queue.high!==0 || queueFd<3 || queueFd>=1024)
    throw new Error("queue_open_invalid");
  frame.fill(0xa5,0x700,0x708);
  var pair=native.call("socketpair",[1,1,0,native.frameAddress+0x700]);
  if (pair.value!==0 || pair.high!==0)
    throw new Error("socketpair_failed");
  readFd=view.getInt32(0x700,true);
  originalReadFd=readFd;
  writerFd=view.getInt32(0x704,true);
  if (readFd<3 || readFd>=1024 || writerFd<3 ||
      writerFd>=1024 || readFd===writerFd ||
      readFd===queueFd || writerFd===queueFd)
    throw new Error("pair_fds_invalid");
  phase="duplicate";
  var dup=native.call("dup",[readFd]);
  dupFd=dup.value;
  if (dup.high!==0 || dupFd<3 || dupFd>=1024 ||
      dupFd===queueFd || dupFd===readFd || dupFd===writerFd)
    throw new Error("duplicate_fd_invalid");
  phase="register_old";
  eventFor(readFd,1);
  addOld=native.call("kevent",[queueFd,
    native.frameAddress+0x800,1,0,0,0]);
  if (addOld.value!==0 || addOld.high!==0)
    throw new Error("old_add_failed");
  registered=readFd;
  phase="close_old";
  closeOld=native.call("close",[readFd]);
  if (closeOld.value!==0 || closeOld.high!==0)
    throw new Error("old_close_failed");
  readFd=-1; registered=-1;
  phase="old_watch_check";
  frame[0xb00]=0x7b;
  writeResult=native.call("write",[writerFd,
    native.frameAddress+0xb00,1]);
  if (writeResult.value!==1 || writeResult.high!==0)
    throw new Error("old_writer_failed");
  emptyRead=readReady();
  for (var i=0;i<64;i++)
    if (frame[0x900+i]!==0xa5) emptyGuard=false;
  if (emptyRead.value!==0 || emptyRead.high!==0 || !emptyGuard)
    throw new Error("old_watch_not_removed");
  phase="register_duplicate";
  eventFor(dupFd,1);
  addDup=native.call("kevent",[queueFd,
    native.frameAddress+0x800,1,0,0,0]);
  if (addDup.value!==0 || addDup.high!==0)
    throw new Error("duplicate_add_failed");
  registered=dupFd;
  dupRead=readReady();
  eventMatched=dupRead.value===1 && dupRead.high===0 &&
    view.getUint32(0x900,true)===dupFd &&
    view.getInt16(0x908,true)===-1;
  for (var j=32;j<64;j++)
    if (frame[0x900+j]!==0xa5) dupGuard=false;
  if (!eventMatched || !dupGuard)
    throw new Error("duplicate_readiness_missing");
  phase="cleanup";
} catch (error) {
  result={id:"socket_alias_close_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,150)}};
} finally {
  if (registered>=3 && queueFd>=3) {
    try {
      eventFor(registered,2);
      deleteDup=native.call("kevent",[queueFd,
        native.frameAddress+0x800,1,0,0,0]);
      cleanupOk=cleanupOk && deleteDup.value===0 &&
        deleteDup.high===0;
    } catch (error) { cleanupOk=false; }
  }
  if (dupFd>=3) cleanupOk=closeFd(dupFd) && cleanupOk;
  if (writerFd>=3) cleanupOk=closeFd(writerFd) && cleanupOk;
  if (readFd>=3) cleanupOk=closeFd(readFd) && cleanupOk;
  if (queueFd>=3) cleanupOk=closeFd(queueFd) && cleanupOk;
  if (!cleanupOk)
    window.__fw14SocketAliasCleanup={queue:queueFd,read:readFd,
      writer:writerFd,duplicate:dupFd,registered:registered};
  if (saved && frame) {
    bytesRestored=true;
    for (var ri=0;ri<regions.length;ri++) {
      var r=regions[ri];
      for (var bi=0;bi<r[1];bi++) frame[r[0]+bi]=saved[ri][bi];
      for (var ci=0;ci<r[1];ci++)
        if (frame[r[0]+ci]!==saved[ri][ci]) bytesRestored=false;
    }
  }
}
if (!result)
  result={id:"socket_alias_close_v2",
    status:addOld && closeOld && emptyRead && addDup && dupRead &&
      emptyGuard && dupGuard && eventMatched && cleanupOk &&
      bytesRestored ? "pass":"fail",
    details:{original_read_fd:originalReadFd,
      close_old_return:closeOld ? closeOld.value:null,
      dup_fd:dupFd,
      old_add_return:addOld ? addOld.value:null,
      old_watch_events:emptyRead ? emptyRead.value:null,
      duplicate_add_return:addDup ? addDup.value:null,
      duplicate_events:dupRead ? dupRead.value:null,
      event_matched:eventMatched,empty_guard:emptyGuard,
      duplicate_guard:dupGuard,cleanup_ok:cleanupOk,
      bytes_restored:bytesRestored}};
else {
  result.details.cleanup_ok=cleanupOk;
  result.details.bytes_restored=bytesRestored;
}
if (cleanupOk && bytesRestored && api &&
    typeof api.markSync==="function")
  api.markSync("socket_alias_restored");
return [result];
