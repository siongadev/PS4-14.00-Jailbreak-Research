// Read-only current-page Mbus client state after one successful init call.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll;
  if(!s||!n||!m||!s.view||!s.ownedTypedView||s.array[0]!==s.a)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===58&&x.name==="libSceMbus.sprx";})[0];
  var rx=mod&&mod.segments.filter(function(x){return x.kind==="rx"&&x.size===49152;})[0];
  var rw=mod&&mod.segments.filter(function(x){return x.kind==="rw"&&x.size===16384;})[0];
  if(!rx||!rw)throw new Error("mbus_map_missing");
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
  phase="read_mbus_state";
  var sig=readAt(rx.start+0x32c0,16);
  var expected=[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,
    0x41,0x55,0x41,0x54,0x53,0x48,0x81,0xec];
  if(!same(sig,expected))throw new Error("mbus_entry_changed");
  var client=valueOf(readAt(rw.start+0xb0,8));
  var initState=valueOf(readAt(rw.start+0xdc,4));
  var vtable=0,kid=0;
  if(client>=0x100000000&&client<0x1000000000000&&client%8===0){
    var head=readAt(client,16);
    vtable=valueOf(head.slice(0,8));kid=valueOf(head.slice(8,12));
  }
  var after=n.call("getpid",[]);
  var restored=same(bytesAt(slot,8),original)&&s.array[0]===s.a&&
    after.high===0&&after.value===pid.value;
  result={id:"mbus_state_v2",status:restored?"pass":"fail",
    details:{pid:pid.value,init_state:initState,client_ptr:"0x"+client.toString(16),
      client_vtable:"0x"+vtable.toString(16),client_kid:kid,restored:restored}};
}catch(error){result={id:"mbus_state_v2",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
