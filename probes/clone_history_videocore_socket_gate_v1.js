// Compare a nonexistent local socket with the live VideoCore client path.
// This opens and closes owned AF_UNIX SOCK_SEQPACKET descriptors only.
var result, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, map=window.__fw14BulkMapAll;
  if (!n || !n.frame || !Number.isSafeInteger(n.frameAddress) ||
      !n.wrappers || typeof n.wrappers.sys97!=="number" ||
      typeof n.wrappers.sys98!=="number" ||
      typeof n.wrappers.close!=="number" || !map)
    throw new Error("native_or_map_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value!==map.pid)
    throw new Error("page_identity_changed");
  var vc=map.modules.filter(function(item){return item.handle===61;})[0];
  if (!vc || vc.name!=="libSceVideoCoreServerInterface.sprx" ||
      !vc.segments.some(function(seg){return seg.kind==="rx" && seg.size===65536;}))
    throw new Error("videocore_mapping_changed");
  var frame=n.frame, base=n.frameAddress;
  if (frame.length<0x900) throw new Error("frame_short");
  var slot=0x500, width=106;
  var original=Array.from(frame.subarray(slot,slot+width));
  function same(a,b) {
    return a.length===b.length && a.every(function(x,i){return x===b[i];});
  }
  function one(label,path) {
    phase=label;
    frame.fill(0,slot,slot+width);
    frame[slot+1]=1; // AF_UNIX in the observed sockaddr_un layout.
    if (path.length+3>width) throw new Error("path_too_long");
    for (var i=0;i<path.length;i++) frame[slot+2+i]=path.charCodeAt(i);
    var opened=n.call("sys97",[1,5,0]);
    var openErr=opened.value===-1?n.readErrno():0;
    if (opened.high!==0 || opened.value<0 || opened.value>=1024)
      return {label:label,open:opened.value,open_errno:openErr,
        connect:null,connect_errno:null,close:null};
    var connected=null,connectErr=0,closed=null,closeErr=0;
    try {
      if (api && api.markSync) api.markSync("vcore_before_"+label);
      var call=n.call("sys98",[opened.value,base+slot,width]);
      connected=call.value;
      connectErr=connected===-1?n.readErrno():0;
      if (api && api.markSync) api.markSync("vcore_after_"+label);
    } finally {
      var done=n.call("close",[opened.value]);
      closed=done.value;
      closeErr=closed===-1?n.readErrno():0;
    }
    return {label:label,open:opened.value,open_errno:openErr,
      connect:connected,connect_errno:connectErr,
      close:closed,close_errno:closeErr};
  }
  var rows=[];
  try {
    rows.push(one("control","/system_tmp/Fw14NoSuchSocket"));
    rows.push(one("videocore","/system_tmp/SceKernelDescPassing"));
  } finally {
    for (var k=0;k<width;k++) frame[slot+k]=original[k];
  }
  var end=n.call("getpid",[]);
  var restored=same(Array.from(frame.subarray(slot,slot+width)),original) &&
    end.high===0 && end.value===pid.value;
  result={id:"videocore_socket_gate_v1",
    status:restored && rows.length===2 && rows.every(function(row){
      return row.close===0;})?"pass":"fail",
    details:{pid:pid.value,rows:JSON.stringify(rows),restored:restored}};
} catch(error) {
  result={id:"videocore_socket_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
