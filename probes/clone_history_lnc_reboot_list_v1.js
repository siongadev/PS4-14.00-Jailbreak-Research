// Query the already-initialized VideoCore IPMI client's peer PID. No
// connection, method, disconnect, or destroy is sent to the live client.
var result,checks,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!s||!n||!m||!f||!n.wrappers.sys622||!n.wrappers.service_status||!s.view||
     !s.ownedTypedView||s.array[0]!==s.a||f.length<0xc00||
     !Number.isSafeInteger(n.frameAddress))
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===49&&
    x.name==="libSceSystemService.sprx";})[0];
  var ipmi=m.modules.filter(function(x){return x.handle===27&&
    x.name==="libSceIpmi.sprx";})[0];
  var rw=mod&&mod.segments.filter(function(x){return x.kind==="rw"&&x.size===16384;})[0];
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
  var o=0x500,saved=Array.from(f.subarray(o,0xa40));
  var official=null,raw=null,rawErrno=0,sysResult=0,methodResult=0,
    prefixHex="",outputHex="",changed=0,hash=2166136261,
    guard=false,client=0,kid=0,vtable=0,outCount=0;
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  function put64(off,v){
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  function hexAt(off,len){
    return Array.from(f.subarray(off,off+len)).map(function(x){
      return ("0"+x.toString(16)).slice(-2);
    }).join("");
  }
  try {
    f.fill(0xa5,o,0xa40);
    phase="official_status_control";
    if(api&&api.markSync)api.markSync("lnc_list_control_before");
    official=n.call("service_status",[n.frameAddress+0x580]);
    if(api&&api.markSync)api.markSync("lnc_list_control_after");
    if(official.value!==0||official.high!==0||
       hexAt(0x580,12)==="a5a5a5a5a5a5a5a5a5a5a5a5")
      throw new Error("official_status_unavailable_"+official.value);
    client=valueOf(readAt(rw.start+0x60,8));
    if(client<rw.start+0x68||client+16>rw.start+rw.size)
      throw new Error("service_client_not_module_owned");
    var head=readAt(client,16);
    vtable=valueOf(head.slice(0,8));
    kid=valueOf(head.slice(8,12));
    if(vtable!==ro.start+0x10||kid<=0||kid>0xffffffff)
      throw new Error("service_client_identity_invalid");
    f.fill(0xa5,o,0xa40);
    dv.setUint32(0x500,0,true);
    dv.setUint32(0x520,0,true);
    dv.setUint32(0x580,1,true);
    dv.setUint32(0x584,0,true);
    put64(0x590,n.frameAddress+0x580);
    put64(0x598,4);
    put64(0x5a0,n.frameAddress+0x600);
    put64(0x5a8,0x42c);
    put64(0x5b0,n.frameAddress+0x584);
    put64(0x5b8,4);
    dv.setUint32(0x540,0x3002f,true);
    dv.setUint32(0x544,1,true);
    dv.setUint32(0x548,2,true);
    dv.setUint32(0x54c,0,true);
    put64(0x550,n.frameAddress+0x590);
    put64(0x558,n.frameAddress+0x5a0);
    put64(0x560,n.frameAddress+0x520);
    put64(0x568,1);
    phase="reboot_status_list_method";
    if(api&&api.markSync)api.markSync("lnc_list_method_before");
    raw=n.call("sys622",[0x320,kid,n.frameAddress+0x500,
      n.frameAddress+0x540,0x30,0]);
    if(api&&api.markSync)api.markSync("lnc_list_method_after");
    rawErrno=raw.value===-1?n.readErrno():0;
    sysResult=dv.getUint32(0x500,true);
    methodResult=dv.getUint32(0x520,true);
    outCount=dv.getUint32(0x584,true);
    for(var j=0;j<0x42c;j++){
      var b=f[0x600+j];
      if(b!==0xa5)changed++;
      hash=Math.imul(hash^b,16777619)>>>0;
    }
    prefixHex=hexAt(0x600,64);
    if(raw.value===0&&raw.high===0&&sysResult===0&&methodResult===0)
      outputHex=hexAt(0x600,0x42c);
    guard=Array.from(f.subarray(0xa2c,0xa3c)).every(function(x){return x===0xa5;});
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"lnc_reboot_list_v1",status:restored&&guard?"pass":"fail",
    details:{pid:pid.value,raw_ret:raw&&raw.value,raw_errno:rawErrno,
      sys_result:sysResult,method_result:methodResult,out_count:outCount,
      changed:changed,fnv32:hash,prefix_hex:prefixHex,
      guard:guard,restored:restored}};
  checks=[result];
  for(var chunk=0;chunk<5;chunk++){
    checks.push({id:"lnc_reboot_bytes_"+chunk,status:"pass",
      details:{available:outputHex.length===0x42c*2,
        hex:outputHex.slice(chunk*512,(chunk+1)*512)}});
  }
} catch(error) {
  checks=[{id:"probe_error",status:"error",
    details:{error:(phase+":"+String(error)).slice(0,180)}}];
}
return checks;
