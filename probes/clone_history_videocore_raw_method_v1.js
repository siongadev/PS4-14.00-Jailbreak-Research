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
  var o=0x500,saved=Array.from(f.subarray(o,o+0x100));
  var official=null,raw=null,rawErrno=0,sysResult=0,methodResult=0,
    officialOutput=0,rawOutput=0,guard=false;
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  function put64(off,v){
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  try {
    f.fill(0xa5,o,o+0x100);
    phase="official_control";
    if(api&&api.markSync)api.markSync("videocore_raw_official_before");
    official=n.call("videocore_query17",[client,n.frameAddress+0x528]);
    if(api&&api.markSync)api.markSync("videocore_raw_official_after");
    officialOutput=dv.getUint32(0x528,true);
    if(official.value!==0||official.high!==0||officialOutput!==1)
      throw new Error("official_control_changed");
    f.fill(0xa5,o,o+0x100);
    dv.setUint32(0x500,0,true);
    dv.setUint32(0x520,0,true);
    put64(0x530,n.frameAddress+0x528);
    put64(0x538,4);
    dv.setUint32(0x540,0x12340017,true);
    dv.setUint32(0x544,0,true);  // input descriptor count
    dv.setUint32(0x548,1,true);  // output descriptor count
    dv.setUint32(0x54c,0,true);
    put64(0x550,0);              // no input descriptor
    put64(0x558,n.frameAddress+0x530);
    put64(0x560,n.frameAddress+0x520);
    put64(0x568,1);              // final word in 14.00 IPMI wrapper
    phase="raw_method";
    if(api&&api.markSync)api.markSync("videocore_raw_method_before");
    raw=n.call("sys622",[0x320,kid,n.frameAddress+0x500,
      n.frameAddress+0x540,0x30,0]);
    if(api&&api.markSync)api.markSync("videocore_raw_method_after");
    rawErrno=raw.value===-1?n.readErrno():0;
    sysResult=dv.getUint32(0x500,true);
    methodResult=dv.getUint32(0x520,true);
    rawOutput=dv.getUint32(0x528,true);
    guard=Array.from(f.subarray(0x52c,0x530)).every(function(x){return x===0xa5;});
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"videocore_raw_method_v1",status:restored&&guard&&raw&&
    raw.value===0&&sysResult===0&&methodResult===0&&rawOutput===officialOutput?
    "pass":"fail",details:{pid:pid.value,kid:kid,
      official_ret:official&&official.value,official_output:officialOutput,
      raw_ret:raw&&raw.value,raw_errno:rawErrno,sys_result:sysResult,
      method_result:methodResult,raw_output:rawOutput,guard:guard,restored:restored}};
} catch(error) {
  result={id:"videocore_raw_method_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
