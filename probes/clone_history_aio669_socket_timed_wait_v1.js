// Probe 14.00 AIO wait with one owned, initially unreadable socketpair
// byte and an owned 10,000-usec timeout. Unblock from the peer before
// final poll/delete/close.
var result,phase="preflight",n=null,f=null,saved=null,fd0=-1,fd1=-1,cleaned=true;
try{
  n=window.__fw14NativeInvoke;
  var s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x1b00||!Number.isSafeInteger(n.frameAddress)||
     !n.wrappers||!s||s.array[0]!==s.a||
     [669,663,664,662].some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
    throw new Error("plan_missing");
  f=n.frame;var a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  saved=Array.from(f.subarray(0x1800,0x1b00));
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  function put64(off,v){
    if(!Number.isSafeInteger(v)||v<0)throw new Error("word_invalid");
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  function fmt(c){return c.value+"/"+c.high+"e"+
    (c.value===-1?n.readErrno():0);}
  f.fill(0,0x1800,0x1b00);
  f.fill(0xa5,0x1900,0x19c0);
  f.fill(0xa5,0x1a80,0x1b00);
  f[0x1a00]=0x5a;
  put64(0x1970,10000);
  phase="socketpair";
  var pair=n.call("socketpair",[1,1,0,a+0x1a20]);
  fd0=dv.getInt32(0x1a20,true);fd1=dv.getInt32(0x1a24,true);
  if(pair.value!==0||fd0<3||fd1<3||fd0===fd1||fd0>1024||fd1>1024)
    throw new Error("socketpair_"+fmt(pair)+"_"+fd0+"_"+fd1);
  put64(0x1800,0);put64(0x1808,1);
  put64(0x1810,a+0x1900);put64(0x1818,a+0x1920);
  dv.setInt32(0x1820,fd0,true);
  phase="submit";
  if(api&&api.markSync)api.markSync("aio_socket_submit_before");
  var sub=n.call("sys669",[1,a+0x1800,1,3,a+0x1940,0]);
  var submit=fmt(sub),id=dv.getInt32(0x1940,true),initial="not_run";
  var initialState=-1,wait="not_run",waitState=-1;
  var sent="not_run",lastPoll="not_run",finalState=-1,del="not_run",delErr=-1;
  if(sub.value===0){
    cleaned=false;
    if(id<=0||id>0x10000000)throw new Error("id_invalid_"+id);
    phase="initial_poll";
    var ip=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
    initial=fmt(ip);initialState=dv.getUint32(0x1960,true);
    phase="wait";
    if(api&&api.markSync)api.markSync("aio_socket_wait_before");
    var ca=n.call("sys663",[a+0x1940,1,a+0x1964,1,a+0x1970,0]);
    wait=fmt(ca);waitState=dv.getUint32(0x1964,true);
    if(api&&api.markSync)api.markSync("aio_socket_wait_after");
    phase="unblock";
    var wr=n.call("write",[fd1,a+0x1a00,1]);
    sent=fmt(wr);
    phase="final_poll";
    for(var i=0;i<256;i++){
      var po=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
      lastPoll=fmt(po);finalState=dv.getUint32(0x1960,true);
      if(po.value===0&&((finalState&0xffff)===3||(finalState&0xffff)===4))break;
    }
    if((finalState&0xffff)===3||(finalState&0xffff)===4){
      phase="delete";
      if(api&&api.markSync)api.markSync("aio_socket_delete_before");
      var de=n.call("sys662",[a+0x1940,1,a+0x1980,0,0,0]);
      del=fmt(de);delErr=dv.getUint32(0x1980,true);
      if(de.value===0&&delErr===0)cleaned=true;
    }
  }
  if(cleaned){
    phase="close";
    var c0=n.call("close",[fd0]),c1=n.call("close",[fd1]);
    if(c0.value!==0||c1.value!==0)throw new Error("close_"+fmt(c0)+"_"+fmt(c1));
    fd0=-1;fd1=-1;
  }
  var guard=true;
  for(var g=0x1a80;g<0x1b00;g++)if(f[g]!==0xa5)guard=false;
  var q=cleaned?n.call("getpid",[]):null;
  result={id:"aio669_socket_timed_wait_v1",
    status:cleaned&&guard&&q.high===0&&q.value===p.value?"pass":"fail",
    details:{pid:p.value,submit:submit,id:id,
      initial:initial+"/state"+initialState,
      wait:wait+"/state"+waitState,
      unblock_write:sent,final_poll:lastPoll+"/state"+finalState,
      delete:del+"/per_id"+delErr,cleaned:cleaned,guard:guard}};
}catch(error){result={id:"aio669_socket_timed_wait_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180),cleaned:cleaned,fd0:fd0,fd1:fd1}};}
finally{
  if(f&&saved&&cleaned)for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
  if(n&&fd0>=0&&cleaned)try{n.call("close",[fd0]);}catch(ignore){}
  if(n&&fd1>=0&&cleaned)try{n.call("close",[fd1]);}catch(ignore){}
}
return [result];
