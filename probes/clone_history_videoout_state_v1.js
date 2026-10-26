// Read the 14.00 VideoOut descriptor and driver state after its initializer.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll;
  if(!s||!n||!m||!s.view||!s.ownedTypedView||s.array[0]!==s.a)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===60&&x.name==="libSceVideoOut.sprx";})[0];
  var rx=mod&&mod.segments.filter(function(x){return x.kind==="rx"&&x.size===98304;})[0];
  var rw=mod&&mod.segments.filter(function(x){return x.kind==="rw"&&x.size===16384;})[0];
  if(!rx||!rw)throw new Error("videoout_map_missing");
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
  phase="read_videoout_state";
  var sig=readAt(rx.start+0x28f0,16);
  var expected=[0x55,0x48,0x89,0xe5,0x41,0x56,0x53,0x48,
    0x83,0xe4,0xe0,0x48,0x83,0xec,0x60,0x4c];
  if(!same(sig,expected))throw new Error("videoout_entry_changed");
  var fd=valueOf(readAt(rw.start+0x34,4));
  if(fd>=0x80000000)fd-=0x100000000;
  var driver=valueOf(readAt(rw.start+0xc0,8));
  var sdk=valueOf(readAt(rw.start+0xc8,4));
  var after=n.call("getpid",[]);
  var restored=same(bytesAt(slot,8),original)&&s.array[0]===s.a&&
    after.high===0&&after.value===pid.value;
  result={id:"videoout_state_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,dce_fd:fd,driver_ptr:"0x"+driver.toString(16),
      sdk_version:sdk,restored:restored}};
}catch(error){result={id:"videoout_state_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
