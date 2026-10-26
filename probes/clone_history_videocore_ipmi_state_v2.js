// Read only the VideoCore module's mapped singleton pointer and event flag.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll;
  if(!s||!n||!m||!s.view||!s.ownedTypedView||s.array[0]!==s.a)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mods=m.modules.filter(function(x){
    return x.handle===61&&x.name==="libSceVideoCoreServerInterface.sprx";
  });
  if(mods.length!==1)throw new Error("module_missing");
  var mod=mods[0],rw=mod.segments.filter(function(x){
    return x.kind==="rw"&&x.size===32768;
  })[0],rx=mod.segments.filter(function(x){
    return x.kind==="rx"&&x.size===65536;
  })[0];
  if(!rw||!rx)throw new Error("segment_missing");
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
  phase="module_state";
  var sig=readAt(rx.start+0x26e0,16);
  var expected=[0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,
    0x41,0x55,0x41,0x54,0x53,0x48,0x81,0xec];
  if(!sig.every(function(x,i){return x===expected[i];}))
    throw new Error("init_code_changed");
  var singleton=valueOf(readAt(rw.start+0x6a0,8));
  var running=valueOf(readAt(rw.start+0x6e8,4));
  if(singleton<rw.start||singleton+0x48>rw.start+rw.size)
    throw new Error("singleton_outside_module_rw");
  var state=readAt(singleton,0x48);
  var pool=valueOf(state.slice(0x08,0x10));
  var ipc=valueOf(state.slice(0x10,0x18));
  var server=valueOf(state.slice(0x18,0x20));
  var client=valueOf(state.slice(0x20,0x28));
  var stop=state[0x29];
  var after=n.call("getpid",[]),restored=original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"videocore_ipmi_state_v2",status:restored?"pass":"fail",
    details:{pid:pid.value,singleton:"0x"+singleton.toString(16),
      running:running,pool:"0x"+pool.toString(16),
      ipc:"0x"+ipc.toString(16),server:"0x"+server.toString(16),
      client:"0x"+client.toString(16),stop:stop,restored:restored}};
} catch(error) {
  result={id:"videocore_ipmi_state_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
