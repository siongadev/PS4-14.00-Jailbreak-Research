// Distinguish an old socket from a replacement at the same numeric fd.
// All operations are sequential; this is a baseline, not a race attempt.
var native=window.__fw14NativeInvoke,plan=window.__fw14NativePlan;
var phase="preflight",result=null,frame=null,view=null;
var queueFd=-1,oldRead=-1,oldWrite=-1,oldDup=-1;
var newRead=-1,newWrite=-1,closedOld=false;
var registered=-1,oldEmpty=null,newEmpty=null;
var newEvent=null,oldEvent=null,guards=true;
var cleanupOk=true,bytesRestored=false,saved=null,regions=null;
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
  view.setUint32(0x818,0x71717171,true);
}
function change(fd,flags) {
  eventFor(fd,flags);
  return native.call("kevent",[queueFd,
    native.frameAddress+0x800,1,0,0,0]);
}
function readOnce() {
  frame.fill(0xa5,0x900,0x940);
  frame.fill(0,0xa00,0xa10);
  var ret=native.call("kevent",[queueFd,0,0,
    native.frameAddress+0x900,1,native.frameAddress+0xa00]);
  for (var i=32;i<64;i++)
    if (frame[0x900+i]!==0xa5) guards=false;
  return ret;
}
function writeByte(fd,offset,value) {
  frame[offset]=value;
  var ret=native.call("write",[fd,native.frameAddress+offset,1]);
  if (ret.value!==1 || ret.high!==0)
    throw new Error("owned_socket_write_failed");
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
  regions=[[0x700,8],[0x720,8],[0x800,32],
           [0x900,64],[0xa00,16],[0xb00,2]];
  saved=regions.map(function (r) {
    return Array.from(frame.subarray(r[0],r[0]+r[1]));
  });
  if (api && typeof api.markSync==="function")
    api.markSync("socket_reuse_preflight");
  phase="old_open";
  var queue=native.call("kqueue",[]);
  queueFd=queue.value;
  if (queue.high!==0 || queueFd<3 || queueFd>=1024)
    throw new Error("queue_open_invalid");
  frame.fill(0xa5,0x700,0x708);
  var pair=native.call("socketpair",[1,1,0,native.frameAddress+0x700]);
  if (pair.value!==0 || pair.high!==0)
    throw new Error("old_pair_open_failed");
  oldRead=view.getInt32(0x700,true);
  oldWrite=view.getInt32(0x704,true);
  if (oldRead<3 || oldRead>=1024 || oldWrite<3 ||
      oldWrite>=1024 || oldRead===oldWrite ||
      oldRead===queueFd || oldWrite===queueFd)
    throw new Error("old_pair_fds_invalid");
  var dup=native.call("dup",[oldRead]);
  oldDup=dup.value;
  if (dup.high!==0 || oldDup<3 || oldDup>=1024 ||
      oldDup===queueFd || oldDup===oldRead || oldDup===oldWrite)
    throw new Error("old_duplicate_invalid");
  phase="old_watch";
  var addOld=change(oldRead,1);
  if (addOld.value!==0 || addOld.high!==0)
    throw new Error("old_add_failed");
  registered=oldRead;
  var closeOld=native.call("close",[oldRead]);
  if (closeOld.value!==0 || closeOld.high!==0)
    throw new Error("old_close_failed");
  closedOld=true; registered=-1;
  phase="replacement_open";
  frame.fill(0xa5,0x720,0x728);
  var replacement=native.call("socketpair",[1,1,0,
    native.frameAddress+0x720]);
  if (replacement.value!==0 || replacement.high!==0)
    throw new Error("replacement_open_failed");
  newRead=view.getInt32(0x720,true);
  newWrite=view.getInt32(0x724,true);
  if (newRead<3 || newRead>=1024 || newWrite<3 ||
      newWrite>=1024 || newRead===newWrite ||
      newRead===queueFd || newWrite===queueFd ||
      newRead===oldDup || newWrite===oldDup ||
      newRead===oldWrite || newWrite===oldWrite)
    throw new Error("replacement_fds_invalid");
  if (newRead!==oldRead)
    throw new Error("numeric_fd_not_reused");
  phase="empty_watch_checks";
  writeByte(oldWrite,0xb00,0x51);
  oldEmpty=readOnce();
  if (oldEmpty.value!==0 || oldEmpty.high!==0 || !guards)
    throw new Error("old_source_stale_watch");
  writeByte(newWrite,0xb01,0x52);
  newEmpty=readOnce();
  if (newEmpty.value!==0 || newEmpty.high!==0 || !guards)
    throw new Error("replacement_source_stale_watch");
  phase="new_source";
  var addNew=change(newRead,1);
  if (addNew.value!==0 || addNew.high!==0)
    throw new Error("new_add_failed");
  registered=newRead;
  newEvent=readOnce();
  if (newEvent.value!==1 || newEvent.high!==0 ||
      view.getUint32(0x900,true)!==newRead ||
      view.getInt16(0x908,true)!==-1 || !guards)
    throw new Error("replacement_event_missing");
  var removeNew=change(newRead,2);
  if (removeNew.value!==0 || removeNew.high!==0)
    throw new Error("new_delete_failed");
  registered=-1;
  phase="old_source";
  var addDup=change(oldDup,1);
  if (addDup.value!==0 || addDup.high!==0)
    throw new Error("old_duplicate_add_failed");
  registered=oldDup;
  oldEvent=readOnce();
  if (oldEvent.value!==1 || oldEvent.high!==0 ||
      view.getUint32(0x900,true)!==oldDup ||
      view.getInt16(0x908,true)!==-1 || !guards)
    throw new Error("old_duplicate_event_missing");
  phase="cleanup";
} catch (error) {
  result={id:"socket_reuse_sequential_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,150)}};
} finally {
  if (registered>=3 && queueFd>=3) {
    try {
      var del=change(registered,2);
      cleanupOk=cleanupOk && del.value===0 && del.high===0;
    } catch (error) { cleanupOk=false; }
  }
  if (newWrite>=3) cleanupOk=closeFd(newWrite) && cleanupOk;
  if (newRead>=3) cleanupOk=closeFd(newRead) && cleanupOk;
  if (oldDup>=3) cleanupOk=closeFd(oldDup) && cleanupOk;
  if (oldWrite>=3) cleanupOk=closeFd(oldWrite) && cleanupOk;
  if (oldRead>=3 && !closedOld)
    cleanupOk=closeFd(oldRead) && cleanupOk;
  if (queueFd>=3) cleanupOk=closeFd(queueFd) && cleanupOk;
  if (!cleanupOk)
    window.__fw14SocketReuseCleanup={queue:queueFd,oldRead:oldRead,
      oldWrite:oldWrite,oldDup:oldDup,newRead:newRead,
      newWrite:newWrite,registered:registered};
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
  result={id:"socket_reuse_sequential_v1",
    status:oldEmpty && newEmpty && newEvent && oldEvent &&
      guards && cleanupOk && bytesRestored ? "pass":"fail",
    details:{queue_fd:queueFd,old_fd:oldRead,duplicate_fd:oldDup,
      replacement_fd:newRead,old_source_events:oldEmpty.value,
      replacement_source_events:newEmpty.value,
      new_registered_events:newEvent.value,
      old_duplicate_events:oldEvent.value,
      guards_intact:guards,cleanup_ok:cleanupOk,
      bytes_restored:bytesRestored}};
else {
  result.details.cleanup_ok=cleanupOk;
  result.details.bytes_restored=bytesRestored;
}
if (cleanupOk && bytesRestored && api &&
    typeof api.markSync==="function")
  api.markSync("socket_reuse_restored");
return [result];
