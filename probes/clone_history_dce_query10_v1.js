// 14.00 VideoOut source shape: DCE ioctl 0xc0308203, subcommand 10,
// 0x48-byte output. Use the descriptor opened by its checked initializer.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!s||!n||!m||!f||!n.wrappers.ioctl||!n.wrappers.close||
     !s.view||!s.ownedTypedView||s.array[0]!==s.a)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===60&&x.name==="libSceVideoOut.sprx";})[0];
  var rw=mod&&mod.segments.filter(function(x){return x.kind==="rw"&&x.size===16384;})[0];
  if(!rw)throw new Error("videoout_map_missing");
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
  function access(addr,count,bytes){
    if(!Number.isSafeInteger(addr)||addr<0x100000000||addr>=0x1000000000000||
       count<1||count>64)throw new Error("access_invalid");
    var p=pointerBytes(addr);
    try{
      for(var j=0;j<8;j++)forged[slot+j]=p[j];
      if(bytes){for(var k=0;k<count;k++)carrier[k]=bytes[k];return bytes;}
      var out=[];for(var r=0;r<count;r++)out.push(carrier[r]);return out;
    }finally{for(var q=0;q<8;q++)forged[slot+q]=original[q];}
  }
  var fd=valueOf(access(rw.start+0x34,4));
  if(fd>=0x80000000)fd-=0x100000000;
  if(fd<3||fd>128)throw new Error("dce_fd_not_live");
  var outer=0x1800,out=0x1900,outLen=0x48,guard=16;
  if(f.length<out+outLen+guard||!Number.isSafeInteger(n.frameAddress))
    throw new Error("frame_too_small");
  var saved=Array.from(f.subarray(outer,out+outLen+guard));
  var call=null,err=null,changed=0,head="",guarded=false,closed=null;
  try{
    f.fill(0,outer,outer+48);
    f.fill(0xa5,out,out+outLen);
    f.fill(0x5a,out+outLen,out+outLen+guard);
    function put32(o,v){for(var k=0;k<4;k++)f[o+k]=Math.floor(v/Math.pow(2,k*8))&255;}
    function put64(o,v){for(var k=0;k<8;k++)f[o+k]=Math.floor(v/Math.pow(2,k*8))&255;}
    put32(outer,10);
    put64(outer+8,0);
    put64(outer+16,n.frameAddress+out);
    put64(outer+24,outLen);
    phase="dce_ioctl";
    if(api&&api.markSync)api.markSync("dce_query10_before");
    call=n.call("ioctl",[fd,0xc0308203,n.frameAddress+outer]);
    err=call.value<0?n.readErrno():0;
    for(var i=0;i<outLen;i++)if(f[out+i]!==0xa5)changed++;
    for(var j=0;j<24;j++)head+=(f[out+j]<16?"0":"")+f[out+j].toString(16);
    guarded=Array.from(f.subarray(out+outLen,out+outLen+guard))
      .every(function(v){return v===0x5a;});
  }finally{
    for(var q=0;q<saved.length;q++)f[outer+q]=saved[q];
    phase="dce_cleanup";
    closed=n.call("close",[fd]);
    if(closed.value===0&&closed.high===0)
      access(rw.start+0x34,4,[255,255,255,255]);
  }
  var fdAfter=valueOf(access(rw.start+0x34,4));
  var after=n.call("getpid",[]);
  var restored=same(bytesAt(slot,8),original)&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[outer+i]===v;})&&
    after.high===0&&after.value===pid.value;
  result={id:"dce_query10_v1",status:restored&&guarded&&closed.value===0&&
      fdAfter===0xffffffff?"pass":"fail",
    details:{pid:pid.value,ioctl_return:call.value,errno:err,
      changed_bytes:changed,head_hex:head,guarded:guarded,
      close_return:closed.value,fd_reset:fdAfter===0xffffffff,restored:restored}};
}catch(error){result={id:"dce_query10_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
