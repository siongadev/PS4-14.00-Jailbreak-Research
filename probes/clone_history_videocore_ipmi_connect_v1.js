// 14.00-source-named SceVideoCoreServer IPMI connection gate. Creates an
// owned client, sends no server method, queries peer PID only on success,
// then disconnects/destroys. All addresses derive from this page's map.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!n||!s||!m||!f||!n.wrappers.sys622||
     !n.wrappers.ipmi_config_init||!n.wrappers.ipmi_client_create||
     !n.wrappers.ipmi_client_destroy||s.array[0]!==s.a||
     !Number.isSafeInteger(n.frameAddress)||f.length<0x2000)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var base=n.frameAddress,dv=new DataView(f.buffer,f.byteOffset,f.byteLength),
    out=0x500,config=0x600,status=0x780,status2=0x784,
    resultOffset=0x788,params=0x790,storage=0x1000;
  var saved=Array.from(f.subarray(out,storage+0x1000));
  var created=null,kid=0,connected=null,connectErrno=0,
    peer=null,peerPid=0,disconnected=null,destroyed=null,
    connectResult=0,disconnectResult=0,guard=true;
  function raw(op,arg,paramsAddress,size) {
    dv.setUint32(resultOffset,0,true);
    dv.setUint32(resultOffset+4,0,true);
    var call=n.call("sys622",[op,arg,base+resultOffset,paramsAddress,size,0]);
    return {ret:call.value,high:call.high,
      errno:call.value===-1?n.readErrno():0,
      result:dv.getUint32(resultOffset,true)};
  }
  function setPtr(offset,value) {
    dv.setUint32(offset,value>>>0,true);
    dv.setUint32(offset+4,Math.floor(value/0x100000000)>>>0,true);
  }
  try {
    f.fill(0,out,storage+0x1000);
    phase="config_init";
    n.call("ipmi_config_init",[base+config]);
    var name="SceVideoCoreServer";
    f.fill(0,config,config+0x20);
    for(var i=0;i<name.length;i++)f[config+i]=name.charCodeAt(i);
    phase="client_create";
    created=n.call("ipmi_client_create",[base+out,base+config,0,base+storage]);
    if(created.high!==0||created.value!==0)throw new Error("client_create_failed_"+created.value);
    kid=dv.getUint32(storage+8,true);
    if(kid===0)throw new Error("client_kid_zero");
    phase="connect";
    f.fill(0,status,params+0x20);
    setPtr(params+0x10,base+status);
    setPtr(params+0x18,base+status2);
    if(api&&api.markSync)api.markSync("videocore_ipmi_before_connect");
    connected=raw(0x400,kid,base+params,0x20);
    if(api&&api.markSync)api.markSync("videocore_ipmi_after_connect");
    connectResult=dv.getUint32(status,true);
    connectErrno=connected.errno;
    if(connected.ret===0) {
      phase="peer_pid";
      f.fill(0,status,params+0x20);
      setPtr(params,base+status);
      peer=raw(0x469,kid,base+params,8);
      peerPid=dv.getUint32(status,true);
    }
  } finally {
    try {
      if(kid!==0) {
        if(connected&&connected.ret===0) {
          phase="disconnect";
          f.fill(0,status,params+0x20);
          setPtr(params,base+status);
          disconnected=raw(0x310,kid,base+params,8);
          disconnectResult=dv.getUint32(status,true);
        }
        phase="destroy";
        destroyed=n.call("ipmi_client_destroy",[base+storage]);
      }
    } finally {
      for(var j=0;j<saved.length;j++)f[out+j]=saved[j];
    }
  }
  var after=n.call("getpid",[]);
  guard=saved.every(function(x,i){return f[out+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"videocore_ipmi_connect_v1",status:guard?"pass":"fail",
    details:{pid:pid.value,kid:kid,create:created?created.value:null,
      connect:connected?connected.ret:null,connect_errno:connectErrno,
      connect_result:connectResult,peer_ret:peer?peer.ret:null,
      peer_errno:peer?peer.errno:null,peer_pid:peerPid,
      disconnect:disconnected?disconnected.ret:null,
      disconnect_result:disconnectResult,
      destroy:destroyed?destroyed.value:null,restored:guard}};
} catch(error) {
  result={id:"videocore_ipmi_connect_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
