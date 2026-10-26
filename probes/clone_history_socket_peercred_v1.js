// Compare LOCAL_PEERCRED on owned socketpair and reachable local services.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,frame=n&&n.frame;
  if (!n || !frame || !Number.isSafeInteger(n.frameAddress) ||
      !n.wrappers || typeof n.wrappers.sys118!=="number" ||
      typeof n.wrappers.sys97!=="number" ||
      typeof n.wrappers.sys98!=="number" ||
      typeof n.wrappers.socketpair!=="number" ||
      typeof n.wrappers.close!=="number" || frame.length<0x900)
    throw new Error("native_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1) throw new Error("pid_invalid");
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var offset=0x500,size=0x210,original=Array.from(frame.subarray(offset,offset+size));
  var sockaddr=0x500,cred=0x600,lenAt=0x650,fdsAt=0x700;
  var rows=[],allClosed=true;
  function close(fd) {
    var ret=n.call("close",[fd]);
    if (ret.value!==0) allClosed=false;
  }
  function peer(fd,label) {
    phase="peer_"+label;
    frame.fill(0xa5,cred,cred+64);
    dv.setUint32(lenAt,64,true);
    var call=n.call("sys118",[fd,0,1,n.frameAddress+cred,n.frameAddress+lenAt]);
    var err=call.value===-1?n.readErrno():0;
    var length=dv.getUint32(lenAt,true),raw="";
    for (var i=0;i<Math.min(length,32,64);i++)
      raw+=(frame[cred+i]+256).toString(16).slice(1);
    return label+":"+call.value+"/"+err+"/"+length+"/"+raw;
  }
  try {
    phase="socketpair";
    frame.fill(0,fdsAt,fdsAt+8);
    var pair=n.call("socketpair",[1,1,0,n.frameAddress+fdsAt]);
    if (pair.value===0 && pair.high===0) {
      var fd0=dv.getInt32(fdsAt,true),fd1=dv.getInt32(fdsAt+4,true);
      if (fd0<0 || fd0>=1024 || fd1<0 || fd1>=1024)
        throw new Error("pair_fds_invalid");
      try {rows.push(peer(fd0,"self"));}
      finally {close(fd0);close(fd1);}
    } else rows.push("self_pair_failed:"+pair.value+"/"+n.readErrno());
    var targets=[
      ["gnm_restricted","/system_tmp/GnmCompositorRestricted"],
      ["video_proxy","/system_tmp/gpvdec_proxy"]
    ];
    for (var t=0;t<targets.length;t++) {
      var label=targets[t][0],path=targets[t][1];
      phase="connect_"+label;
      frame.fill(0,sockaddr,sockaddr+106);
      frame[sockaddr+1]=1;
      for (var j=0;j<path.length;j++)
        frame[sockaddr+2+j]=path.charCodeAt(j);
      var opened=n.call("sys97",[1,1,0]);
      if (opened.value<0 || opened.value>=1024 || opened.high!==0) {
        rows.push(label+"_socket_failed:"+opened.value+"/"+n.readErrno());
        continue;
      }
      try {
        if (api && api.markSync) api.markSync("peer_before_"+label);
        var connected=n.call("sys98",[opened.value,
          n.frameAddress+sockaddr,106]);
        if (connected.value===0 && connected.high===0)
          rows.push(peer(opened.value,label));
        else rows.push(label+"_connect_failed:"+connected.value+"/"+
          n.readErrno());
        if (api && api.markSync) api.markSync("peer_after_"+label);
      } finally {close(opened.value);}
    }
  } finally {
    for (var k=0;k<original.length;k++) frame[offset+k]=original[k];
  }
  var end=n.call("getpid",[]);
  var restored=end.high===0 && end.value===pid.value &&
    original.every(function(v,i){return frame[offset+i]===v;});
  result={id:"socket_peercred_v1",
    status:restored && allClosed && rows.length===3?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|"),restored:restored,
      all_closed:allClosed}};
} catch(error) {
  result={id:"socket_peercred_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
