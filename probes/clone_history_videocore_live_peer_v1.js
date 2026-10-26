// Query the already-initialized VideoCore IPMI client's peer PID. No
// connection, method, disconnect, or destroy is sent to the live client.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!s||!n||!m||!f||!n.wrappers.sys622||!s.view||
     !s.ownedTypedView||s.array[0]!==s.a||f.length<0x600||
     !Number.isSafeInteger(n.frameAddress))
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===61&&
    x.name==="libSceVideoCoreServerInterface.sprx";})[0];
  var ipmi=m.modules.filter(function(x){return x.handle===27&&
    x.name==="libSceIpmi.sprx";})[0];
  var rw=mod&&mod.segments.filter(function(x){return x.kind==="rw"&&x.size===32768;})[0];
  var ro=ipmi&&ipmi.segments.filter(function(x){return x.kind==="ro"&&x.size===16384;})[0];
  if(!rw||!ro)throw new Error("module_map_missing");
  var forged=s.view,carrier=s.ownedTypedView,base=s.calibratedViewBase;
  if(carrier.length!==65536||carrier[0]!==0x31||carrier[7]!==0xa8||base%4096!==0)
    throw new Error("carrier_changed");
  function bytesAt(i,c){var a=[];for(var j=0;j<c;j++)a.push(forged[i+j]);return a;}
  function valueOf(a){var v=0;for(var j=a.length-1;j>=0;j--)v=v*256+a[j];return v;}
  function pointerBytes(v){var a=[];for(var j=0;j<8;j++)a.push(Math.floor(v/Math.pow(2,j*8))&255);return a;}
  var obj;
  try{s.array[0]=carrier;obj=valueOf(bytesAt(s.index,8));}
  finally{s.array[0]=s.a;}
  var slot=obj-base+8;
  if(!Number.isSafeInteger(slot)||slot<0||slot+8>=16777216)
    throw new Error("carrier_slot_invalid");
  var original=bytesAt(slot,8);
  function readAt(addr,count){
    if(!Number.isSafeInteger(addr)||addr<0x100000000||addr>=0x1000000000000||
       count<1||count>64)throw new Error("read_invalid");
    var p=pointerBytes(addr);
    try{
      for(var j=0;j<8;j++)forged[slot+j]=p[j];
      var out=[];for(var r=0;r<count;r++)out.push(carrier[r]);return out;
    }finally{for(var k=0;k<8;k++)forged[slot+k]=original[k];}
  }
  phase="live_client_read";
  var singleton=valueOf(readAt(rw.start+0x6a0,8));
  if(singleton<rw.start||singleton+0x30>rw.start+rw.size)
    throw new Error("singleton_not_rw");
  var state=readAt(singleton,0x30),pool=valueOf(state.slice(8,16)),
    client=valueOf(state.slice(0x20,0x28));
  if(!Number.isSafeInteger(pool)||!Number.isSafeInteger(client)||
     pool<0x100000000||client<pool||client+0x10>pool+0x4000)
    throw new Error("client_not_in_owned_pool");
  var head=readAt(client,16),vtable=valueOf(head.slice(0,8)),
    kid=valueOf(head.slice(8,12));
  if(vtable<ro.start||vtable>=ro.start+ro.size||kid<=0||kid>0xffffffff)
    throw new Error("client_vtable_or_kid_invalid");
  var o=0x500,saved=Array.from(f.subarray(o,o+0x40));
  var call=null,errno=0,peerPid=0,status=0;
  try {
    f.fill(0,o,o+0x40);
    var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
    dv.setUint32(o,(n.frameAddress+0x520)>>>0,true);
    dv.setUint32(o+4,Math.floor((n.frameAddress+0x520)/0x100000000)>>>0,true);
    phase="peer_query";
    if(api&&api.markSync)api.markSync("videocore_live_peer_before");
    call=n.call("sys622",[0x469,kid,n.frameAddress+0x528,n.frameAddress+o,8,0]);
    if(api&&api.markSync)api.markSync("videocore_live_peer_after");
    errno=call.value===-1?n.readErrno():0;
    peerPid=dv.getUint32(0x520,true);
    status=dv.getUint32(0x528,true);
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"videocore_live_peer_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,kid:kid,ret:call.value,errno:errno,
      result:status,peer_pid:peerPid,client:"0x"+client.toString(16),
      vtable:"0x"+vtable.toString(16),restored:restored}};
} catch(error) {
  result={id:"videocore_live_peer_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
