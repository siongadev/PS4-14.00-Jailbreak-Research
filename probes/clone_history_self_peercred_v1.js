// Bind a browser-owned Unix socket, connect to it, and read its peer UID.
var result,phase="preflight",frame,original;
try {
  var n=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if (!n || !state || state.array[0]!==state.a || !n.frame ||
      !Number.isSafeInteger(n.frameAddress) || n.frame.length<0x900 ||
      !n.wrappers || !n.wrappers.sys10 || !n.wrappers.sys97 ||
      !n.wrappers.sys98 || !n.wrappers.sys104 || !n.wrappers.sys106 ||
      !n.wrappers.sys118 || !n.wrappers.close)
    throw new Error("native_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1 || pid.value>100000)
    throw new Error("pid_invalid");
  frame=n.frame;
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  original=Array.from(frame.subarray(0x500,0x780));
  var sockaddr=0x500,cred=0x600,lenAt=0x650;
  var path="/system_tmp/Fw14Cred"+pid.value+"_"+
    (Date.now()>>>0).toString(16);
  if (path.length>100) throw new Error("path_too_long");
  frame.fill(0,sockaddr,sockaddr+106);
  frame[sockaddr+1]=1;
  for (var p=0;p<path.length;p++)
    frame[sockaddr+2+p]=path.charCodeAt(p);
  var listener=-1,client=-1,bound=false,closed=true;
  var bindRet=null,bindErr=0,listenRet=null,listenErr=0;
  var connectRet=null,connectErr=0,peerRet=null,peerErr=0;
  var peerLen=null,peerRaw="",unlinkRet=null,unlinkErr=0;
  function close(fd) {
    if (fd<0) return;
    var ret=n.call("close",[fd]);
    if (ret.value!==0) closed=false;
  }
  try {
    phase="socket_listener";
    var opened=n.call("sys97",[1,1,0]);
    if (opened.value<0 || opened.value>=1024 || opened.high!==0)
      throw new Error("listener_socket_failed:"+opened.value+"/"+
        n.readErrno());
    listener=opened.value;
    phase="bind";
    var b=n.call("sys104",[listener,n.frameAddress+sockaddr,106]);
    bindRet=b.value;
    if (bindRet!==0) bindErr=n.readErrno();
    else {
      bound=true;
      phase="listen";
      var l=n.call("sys106",[listener,1]);
      listenRet=l.value;
      if (listenRet!==0) listenErr=n.readErrno();
      else {
        phase="socket_client";
        var c=n.call("sys97",[1,1,0]);
        if (c.value<0 || c.value>=1024 || c.high!==0)
          throw new Error("client_socket_failed:"+c.value+"/"+
            n.readErrno());
        client=c.value;
        if (api && api.markSync) api.markSync("self_peer_before_connect");
        phase="connect";
        var conn=n.call("sys98",[client,n.frameAddress+sockaddr,106]);
        connectRet=conn.value;
        if (connectRet!==0) connectErr=n.readErrno();
        else {
          phase="peercred";
          frame.fill(0xa5,cred,cred+64);
          dv.setUint32(lenAt,64,true);
          var peer=n.call("sys118",[client,0,1,n.frameAddress+cred,
            n.frameAddress+lenAt]);
          peerRet=peer.value;
          if (peerRet!==0) peerErr=n.readErrno();
          peerLen=dv.getUint32(lenAt,true);
          for (var i=0;i<Math.min(peerLen,32,64);i++)
            peerRaw+=(frame[cred+i]+256).toString(16).slice(1);
        }
        if (api && api.markSync) api.markSync("self_peer_after_call");
      }
    }
  } finally {
    phase="cleanup";
    close(client);
    close(listener);
    if (bound) {
      var u=n.call("sys10",[n.frameAddress+sockaddr+2]);
      unlinkRet=u.value;
      if (unlinkRet!==0) unlinkErr=n.readErrno();
    }
  }
  for (var x=0;x<original.length;x++) frame[0x500+x]=original[x];
  var end=n.call("getpid",[]);
  var restored=end.high===0 && end.value===pid.value &&
    original.every(function(v,i){return frame[0x500+i]===v;}) &&
    state.array[0]===state.a;
  var calibrated=bindRet===0 && listenRet===0 && connectRet===0 &&
    peerRet===0 && peerLen>=10 && peerRaw.slice(0,8)==="00000000" &&
    peerRaw.slice(8,16)==="01000000" &&
    peerRaw.slice(16,20)==="0100";
  result={id:"self_peercred_v1",
    status:restored && closed && (!bound || unlinkRet===0)?"pass":"fail",
    details:{pid:pid.value,path:path,bind:bindRet,bind_errno:bindErr,
      listen:listenRet,listen_errno:listenErr,connect:connectRet,
      connect_errno:connectErr,peer:peerRet,peer_errno:peerErr,
      peer_len:peerLen,peer_hex:peerRaw,calibrated:calibrated,
      unlink:unlinkRet,unlink_errno:unlinkErr,closed:closed,
      restored:restored}};
} catch(error) {
  result={id:"self_peercred_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
} finally {
  if (frame && original)
    for (var z=0;z<original.length;z++) frame[0x500+z]=original[z];
}
return [result];
