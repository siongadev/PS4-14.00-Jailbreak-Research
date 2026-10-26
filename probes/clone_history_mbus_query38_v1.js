// Source-defined Mbus 0xce110038 query: no inputs, 0xb10-byte owned output.
// The v42 caller verifies the live 14.00 entry bytes before this call.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!s||!n||!m||!f||!n.wrappers.mbus_query||!s.view||
     !s.ownedTypedView||s.array[0]!==s.a)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===58&&x.name==="libSceMbus.sprx";})[0];
  var rw=mod&&mod.segments.filter(function(x){return x.kind==="rw"&&x.size===16384;})[0];
  if(!rw)throw new Error("mbus_map_missing");
  var forged=s.view,carrier=s.ownedTypedView,base=s.calibratedViewBase;
  if(carrier.length!==65536||carrier[0]!==0x31||carrier[7]!==0xa8||base%4096!==0)
    throw new Error("carrier_changed");
  function bytesAt(i,c){var a=[];for(var j=0;j<c;j++)a.push(forged[i+j]);return a;}
  function valueOf(a){var v=0;for(var j=a.length-1;j>=0;j--)v=v*256+a[j];return v;}
  function pointerBytes(v){
    if(!Number.isSafeInteger(v)||v<0||v>=0x1000000000000)throw new Error("pointer_invalid");
    var a=[];for(var j=0;j<8;j++)a.push(Math.floor(v/Math.pow(2,j*8))&255);return a;
  }
  function same(a,b){return a.length===b.length&&a.every(function(v,i){return v===b[i];});}
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
  var client=valueOf(readAt(rw.start+0xb0,8));
  var initState=valueOf(readAt(rw.start+0xdc,4));
  if(initState!==2||client<0x100000000||client>=0x1000000000000||client%8)
    throw new Error("mbus_client_uninitialized");
  var vtable=valueOf(readAt(client,8));
  var ipmi=m.modules.filter(function(x){return x.handle===27&&x.name==="libSceIpmi.sprx";})[0];
  var ipmiRo=ipmi&&ipmi.segments.filter(function(x){return x.kind==="ro";})[0];
  if(!ipmiRo||vtable!==ipmiRo.start+0x10)throw new Error("mbus_client_vtable_changed");
  var off=0x1800,len=0xb10,guard=16;
  if(f.length<off+len+guard||!Number.isSafeInteger(n.frameAddress))
    throw new Error("frame_too_small");
  var saved=Array.from(f.subarray(off,off+len+guard));
  var call=null,changed=0,head="",guarded=false;
  try{
    f.fill(0xa5,off,off+len);
    f.fill(0x5a,off+len,off+len+guard);
    phase="mbus_query";
    if(api&&api.markSync)api.markSync("mbus_query38_before");
    call=n.call("mbus_query",[client,n.frameAddress+off]);
    for(var i=0;i<len;i++)if(f[off+i]!==0xa5)changed++;
    for(var j=0;j<32;j++)head+=(f[off+j]<16?"0":"")+f[off+j].toString(16);
    guarded=Array.from(f.subarray(off+len,off+len+guard))
      .every(function(v){return v===0x5a;});
  }finally{for(var q=0;q<saved.length;q++)f[off+q]=saved[q];}
  var after=n.call("getpid",[]);
  var restored=same(bytesAt(slot,8),original)&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[off+i]===v;})&&
    after.high===0&&after.value===pid.value;
  result={id:"mbus_query38_v1",status:restored&&guarded?"pass":"fail",
    details:{pid:pid.value,return_value:call?call.value:null,
      return_high:call?call.high:null,changed_bytes:changed,
      head_hex:head,guarded:guarded,restored:restored}};
}catch(error){result={id:"mbus_query38_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
