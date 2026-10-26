// 14.00 chain: pending AIO socket read + fd-number reuse. An old duplicate
// keeps the original socket alive while a new pair takes its former fd.
// Distinct peer bytes show which socket the AIO request actually reads.
var result=null,phase="preflight",n=null,f=null,saved=null;
var oldRead=-1,oldWrite=-1,oldDup=-1,newRead=-1,newWrite=-1;
var requestLive=false,cleaned=true,oldReadClosed=false;
var submit="not_run",id=-1,initial=-1,closeResult="not_run";
var pairReuse=false,newWriteResult="not_run",newWait="not_run",newState=-1;
var oldWriteResult="not_run",oldWait="not_run",finalState=-1;
var finalByte=-1,resultBytes=-1,delResult="not_run",delError=-1;
var guards=true,restored=false,pid=-1;
try {
  n=window.__fw14NativeInvoke;
  var s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x1b00||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers||
     !n.wrappers.dup||!n.wrappers.socketpair||!n.wrappers.close||
     !n.wrappers.write||!s||s.array[0]!==s.a||
     [662,663,664,669].some(function(v){
       return typeof n.wrappers["sys"+v]!=="number";
     })) throw new Error("native_plan_missing");
  f=n.frame;
  var a=n.frameAddress,dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  var p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  pid=p.value;
  saved=Array.from(f.subarray(0x1800,0x1b00));
  function put64(off,v) {
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  function fmt(c){return c.value+"/"+c.high+"e"+
    (c.value===-1?n.readErrno():0);}
  function terminal(state){return (state&0xffff)===3||(state&0xffff)===4;}
  function wait10k() {
    var w=n.call("sys663",[a+0x1940,1,a+0x1964,1,a+0x1970,0]);
    var state=dv.getUint32(0x1964,true);
    return {result:fmt(w),state:state};
  }
  function poll(){
    var c=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
    if(c.value!==0)throw new Error("poll_"+fmt(c));
    return dv.getUint32(0x1960,true);
  }
  f.fill(0,0x1800,0x1b00);
  f.fill(0xa5,0x1900,0x19c0);
  f.fill(0xa5,0x1a80,0x1b00);
  f[0x1a00]=0x51;
  f[0x1a01]=0x52;
  put64(0x1970,10000);
  phase="old_pair";
  var pair=n.call("socketpair",[1,1,0,a+0x1a20]);
  oldRead=dv.getInt32(0x1a20,true);
  oldWrite=dv.getInt32(0x1a24,true);
  if(pair.value!==0||oldRead<3||oldRead>=1024||oldWrite<3||
     oldWrite>=1024||oldRead===oldWrite)
    throw new Error("old_pair_"+fmt(pair));
  phase="duplicate";
  var dup=n.call("dup",[oldRead]);
  oldDup=dup.value;
  if(dup.high!==0||oldDup<3||oldDup>=1024||
     oldDup===oldRead||oldDup===oldWrite)
    throw new Error("old_dup_"+fmt(dup));
  put64(0x1800,0);put64(0x1808,1);
  put64(0x1810,a+0x1900);put64(0x1818,a+0x1920);
  dv.setInt32(0x1820,oldRead,true);
  phase="submit";
  if(api&&api.markSync)api.markSync("aio_rebind_submit_before");
  var sub=n.call("sys669",[1,a+0x1800,1,3,a+0x1940,0]);
  submit=fmt(sub);id=dv.getInt32(0x1940,true);
  if(sub.value!==0||id<=0||id>0x10000000)
    throw new Error("submit_"+submit+"_id"+id);
  requestLive=true;cleaned=false;
  initial=poll();
  if(terminal(initial))throw new Error("read_not_pending_"+initial);
  phase="close_old_read";
  if(api&&api.markSync)api.markSync("aio_rebind_close_before");
  var cl=n.call("close",[oldRead]);closeResult=fmt(cl);
  if(cl.value!==0||cl.high!==0)throw new Error("close_old_"+closeResult);
  oldReadClosed=true;
  phase="replacement_pair";
  var replacement=n.call("socketpair",[1,1,0,a+0x1a28]);
  newRead=dv.getInt32(0x1a28,true);
  newWrite=dv.getInt32(0x1a2c,true);
  if(replacement.value!==0||newRead<3||newRead>=1024||
     newWrite<3||newWrite>=1024||newRead===newWrite||
     newRead===oldWrite||newRead===oldDup||
     newWrite===oldWrite||newWrite===oldDup)
    throw new Error("replacement_"+fmt(replacement));
  pairReuse=newRead===oldRead;
  phase="write_replacement_peer";
  if(api&&api.markSync)api.markSync("aio_rebind_new_write_before");
  var wrNew=n.call("write",[newWrite,a+0x1a01,1]);
  newWriteResult=fmt(wrNew);
  if(wrNew.value!==1||wrNew.high!==0)
    throw new Error("new_write_"+newWriteResult);
  phase="wait_after_replacement";
  var wn=wait10k();newWait=wn.result;newState=poll();
  if(api&&api.markSync)api.markSync("aio_rebind_new_wait_after");
  if(!terminal(newState)) {
    phase="write_original_peer";
    var wrOld=n.call("write",[oldWrite,a+0x1a00,1]);
    oldWriteResult=fmt(wrOld);
    if(wrOld.value!==1||wrOld.high!==0)
      throw new Error("old_write_"+oldWriteResult);
    var wo=wait10k();oldWait=wo.result;finalState=poll();
    if(!terminal(finalState)){
      for(var i=0;i<256;i++){
        finalState=poll();
        if(terminal(finalState))break;
      }
    }
  } else finalState=newState;
  if(!terminal(finalState))throw new Error("request_still_pending_"+finalState);
  finalByte=f[0x1900];resultBytes=dv.getUint32(0x1920,true);
  phase="delete";
  var de=n.call("sys662",[a+0x1940,1,a+0x1980,0,0,0]);
  delResult=fmt(de);delError=dv.getUint32(0x1980,true);
  if(de.value!==0||delError!==0)
    throw new Error("delete_"+delResult+"_"+delError);
  requestLive=false;cleaned=true;
  phase="close_all";
  var fdSummary=oldRead+"/"+oldDup+"/"+newRead+"/"+newWrite;
  var fds=[newWrite,newRead,oldDup,oldWrite];
  for(var j=0;j<fds.length;j++){
    var c=n.call("close",[fds[j]]);
    if(c.value!==0||c.high!==0)throw new Error("close_fd_"+fds[j]+"_"+fmt(c));
  }
  newWrite=newRead=oldDup=oldWrite=-1;
  for(var g=0x1a80;g<0x1b00;g++)if(f[g]!==0xa5)guards=false;
  var q=n.call("getpid",[]);
  result={id:"aio_fd_rebind_v2",
    status:pairReuse&&initial===2&&((newState&0xffff)===2)&&
      ((finalState&0xffff)===3)&&finalByte===0x51&&
      resultBytes===1&&guards&&q.value===pid&&q.high===0?"pass":"fail",
    details:{pid:pid,fds:fdSummary,reused:pairReuse,
      submit:submit+"/id"+id,
      states:initial+"/"+newState+"/"+finalState,
      close_old:closeResult,
      writes:newWriteResult+"/"+oldWriteResult,
      waits:newWait+"/"+oldWait,
      result:finalByte+"/"+resultBytes,
      delete:delResult+"/per_id"+delError,
      guards:guards}};
} catch(error) {
  result={id:"aio_fd_rebind_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,170),pid:pid,
      id:id,request_live:requestLive,cleaned:cleaned,
      old_fd:oldRead,old_dup:oldDup,new_fd:newRead,
      initial_state:initial,new_state:newState,final_state:finalState}};
} finally {
  // Do not invalidate buffers while a kernel request may still own them.
  if(f&&saved&&cleaned){
    for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
    restored=true;
  }
  if(n&&cleaned){
    var left=[newWrite,newRead,oldDup,oldWrite];
    if(!oldReadClosed)left.push(oldRead);
    for(var k=0;k<left.length;k++)if(left[k]>=3)
      try{n.call("close",[left[k]]);}catch(ignore){}
  }
}
if(result&&result.details)result.details.frame_restored=restored;
return [result];
