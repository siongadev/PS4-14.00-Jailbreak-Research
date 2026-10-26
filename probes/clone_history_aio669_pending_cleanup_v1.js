// Finish the sibling deletion left by duplicate_delete_v1 on this same page.
// IDs and descriptor are read from its still-live frame and checked against
// the immediately preceding capture; no pointer is reused across pages.
var result,phase="preflight",n=window.__fw14NativeInvoke;
try{
  var s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x1b00||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a||!n.wrappers||
     [662,664].some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
    throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  var p=n.call("getpid",[]);
  var id0=dv.getInt32(0x1940,true),id1=dv.getInt32(0x1944,true);
  var fd0=dv.getInt32(0x1820,true),fd1=dv.getInt32(0x1848,true);
  if(p.high!==0||p.value!==62||id0!==8295||id1!==73831||
     fd0!==fd1||fd0<3||fd0>1024)
    throw new Error("page_or_state_changed");
  phase="sibling_poll";
  var poll=n.call("sys664",[a+0x1944,1,a+0x1964,0,0,0]);
  var state=dv.getUint32(0x1964,true);
  if(poll.value!==0||(state&0xffff)!==3)
    throw new Error("sibling_not_completed_"+state);
  phase="sibling_delete";
  if(api&&api.markSync)api.markSync("aio_pending_delete_before");
  var del=n.call("sys662",[a+0x1944,1,a+0x1988,0,0,0]);
  var perId=dv.getUint32(0x1988,true);
  if(api&&api.markSync)api.markSync("aio_pending_delete_after");
  if(del.value!==0||perId!==0)
    throw new Error("sibling_delete_failed_"+del.value+"_"+perId);
  phase="close";
  var closed=n.call("close",[fd0]);
  if(closed.value!==0)throw new Error("close_failed_"+closed.value);
  var q=n.call("getpid",[]);
  result={id:"aio669_pending_cleanup_v1",status:q.high===0&&q.value===p.value?"pass":"fail",
    details:{pid:p.value,ids:id0+","+id1,fd:fd0,poll_state:state,
      sibling_delete:del.value,per_id:perId,close:closed.value,
      frame_note:"prior_saved_bytes_unavailable"}};
}catch(error){result={id:"aio669_pending_cleanup_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
