// Check whether generic handle deletion recognizes a pending, owned AIO
// socket read under candidate kind 0x160, then unblock and clean up.
var result,phase="preflight",n=null,f=null,saved=null,fd0=-1,fd1=-1,cleaned=true;
try{
  n=window.__fw14NativeInvoke;var s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x1b00||!Number.isSafeInteger(n.frameAddress)||
     !n.wrappers||!s||s.array[0]!==s.a||
     [669,664,662,558].some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
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
  phase="socketpair";
  var pair=n.call("socketpair",[1,1,0,a+0x1a20]);
  fd0=dv.getInt32(0x1a20,true);fd1=dv.getInt32(0x1a24,true);
  if(pair.value!==0||fd0<3||fd1<3||fd0===fd1||fd0>1024||fd1>1024)
    throw new Error("socketpair_"+fmt(pair)+"_"+fd0+"_"+fd1);
  put64(0x1800,0);put64(0x1808,1);
  put64(0x1810,a+0x1900);put64(0x1818,a+0x1920);
  dv.setInt32(0x1820,fd0,true);
  phase="submit";
  if(api&&api.markSync)api.markSync("aio_socket_control_submit_before");
  var sub=n.call("sys669",[1,a+0x1800,1,3,a+0x1940,0]);
  var submit=fmt(sub),id=dv.getInt32(0x1940,true);
  var initial="not_run",initialState=-1,absent="not_run";
  var cross="not_run",crossAccepted=false,controlOk=false;
  var pendingOk=false,write="not_run";
  var lastPoll="not_run",finalState=-1,del="not_run",delErr=-1;
  if(sub.value===0){
    cleaned=false;
    if(id<=0||id>0x10000000)throw new Error("id_invalid_"+id);
    phase="initial_poll";
    var ip=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
    initial=fmt(ip);initialState=dv.getUint32(0x1960,true);
    pendingOk=ip.value===0&&(initialState&0xffff)===2;
    phase="absent_kind_control";
    var no=n.call("sys558",[0x7fffff00,0x160,0,0,0,0]);
    absent=fmt(no);controlOk=no.value===-1&&n.readErrno()===3;
    if(controlOk&&pendingOk){
      phase="pending_kind_target";
      if(api&&api.markSync)api.markSync("aio558_pending_before");
      var hit=n.call("sys558",[id,0x160,0,0,0,0]);
      cross=fmt(hit);
      crossAccepted=hit.value===0&&hit.high===0;
      if(api&&api.markSync)api.markSync("aio558_pending_after");
    }
    phase="unblock";
    if(api&&api.markSync)api.markSync("aio_socket_control_write_before");
    var wr=n.call("write",[fd1,a+0x1a00,1]);
    write=fmt(wr);
    phase="final_poll";
    for(var i=0;i<256;i++){
      var po=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
      lastPoll=fmt(po);finalState=dv.getUint32(0x1960,true);
      if(po.value===0&&((finalState&0xffff)===3||(finalState&0xffff)===4))break;
    }
    if((finalState&0xffff)===3||(finalState&0xffff)===4){
      phase="delete";
      if(api&&api.markSync)api.markSync("aio_socket_control_delete_before");
      var de=n.call("sys662",[a+0x1940,1,a+0x1980,0,0,0]);
      del=fmt(de);delErr=dv.getUint32(0x1980,true);
      if(de.value===0&&(delErr===0||
         (crossAccepted&&delErr===0x80020003)))
        cleaned=true;
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
  result={id:"aio558_pending_kind_v1",
    status:cleaned&&guard&&controlOk&&pendingOk&&q.high===0&&q.value===p.value?"pass":"fail",
    details:{pid:p.value,submit:submit,id:id,
      initial:initial+"/state"+initialState,absent:absent,cross:cross,
      unblock_write:write,
      final_poll:lastPoll+"/state"+finalState,
      result_low:dv.getUint32(0x1920,true),
      delete:del+"/per_id"+delErr,cleaned:cleaned,guard:guard}};
}catch(error){result={id:"aio558_pending_kind_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180),cleaned:cleaned,fd0:fd0,fd1:fd1}};}
finally{
  if(f&&saved&&cleaned)for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
  if(n&&fd0>=0&&cleaned)try{n.call("close",[fd0]);}catch(ignore){}
  if(n&&fd1>=0&&cleaned)try{n.call("close",[fd1]);}catch(ignore){}
}
return [result];
