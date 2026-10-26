// Confirm syscall 649's own-module pointer against the mapped 14.00
// Sysmodule data segment, then read only the 0x18-byte parameter header.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!n||!s||!m||!f||!n.wrappers.sys649||!s.view||
     !s.ownedTypedView||s.array[0]!==s.a||
     !Number.isSafeInteger(n.frameAddress)||f.length<0x800)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mods=m.modules.filter(function(x){
    return x.name==="libSceSysmodule.sprx"&&x.handle>0;
  });
  if(mods.length!==1)throw new Error("module_missing");
  var mod=mods[0],rw=mod.segments.filter(function(x){
    return x.kind==="rw"&&x.size>=0x18;
  })[0];
  if(!rw)throw new Error("rw_segment_missing");
  var o=0x500,saved=Array.from(f.subarray(o,o+16)),call=null,ptr=0;
  try {
    f.fill(0xa5,o,o+8);f.fill(0x5a,o+8,o+16);
    phase="member8_call";
    if(api&&api.markSync)api.markSync("sysmodule_header_before");
    call=n.call("sys649",[mod.handle,8,n.frameAddress+o]);
    if(api&&api.markSync)api.markSync("sysmodule_header_after");
    var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
    ptr=dv.getUint32(o,true)+dv.getUint32(o+4,true)*0x100000000;
    if(call.high!==0||call.value!==0||
       Array.from(f.subarray(o+8,o+16)).some(function(x){return x!==0x5a;}))
      throw new Error("member8_result_invalid");
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  if(!Number.isSafeInteger(ptr)||ptr<rw.start||ptr+0x18>rw.start+rw.size)
    throw new Error("pointer_outside_module_rw");
  var forged=s.view,carrier=s.ownedTypedView,base=s.calibratedViewBase;
  if(carrier.length!==65536||carrier[0]!==0x31||carrier[7]!==0xa8||base%4096!==0)
    throw new Error("carrier_changed");
  function bytesAt(i,c){var a=[];for(var j=0;j<c;j++)a.push(forged[i+j]);return a;}
  function valueOf(a){var v=0;for(var j=a.length-1;j>=0;j--)v=v*256+a[j];return v;}
  function pointerBytes(v){
    var a=[];for(var j=0;j<8;j++)a.push(Math.floor(v/Math.pow(2,j*8))&255);return a;
  }
  var obj;
  try{s.array[0]=carrier;obj=valueOf(bytesAt(s.index,8));}
  finally{s.array[0]=s.a;}
  var slot=obj-base+8;
  if(!Number.isSafeInteger(slot)||slot<0||slot+8>=16777216)
    throw new Error("carrier_slot_invalid");
  var original=bytesAt(slot,8),header=[];
  try {
    var p=pointerBytes(ptr);
    for(var j=0;j<8;j++)forged[slot+j]=p[j];
    for(var q=0;q<0x18;q++)header.push(carrier[q]);
  } finally {
    for(var t=0;t<8;t++)forged[slot+t]=original[t];
  }
  var size=valueOf(header.slice(0,8)),sdk=valueOf(header.slice(0x10,0x14));
  var head=header.map(function(x){return (x<16?"0":"")+x.toString(16);}).join("");
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"sysmodule_member8_header_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,handle:mod.handle,ret:call.value,
      pointer:"0x"+ptr.toString(16),rw_start:"0x"+rw.start.toString(16),
      size:size,sdk:sdk,header_hex:head,restored:restored}};
} catch(error) {
  result={id:"sysmodule_member8_header_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
