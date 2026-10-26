// Check whether the generic 558 handle deleter recognizes a completed,
// owned AIO ID under candidate kind 0x160. Always check an absent ID first.
var result,phase="preflight",n=null,f=null,saved=null,fd=-1,cleaned=true;
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
  var path="/dev/random";
  for(var i=0;i<path.length;i++)f[0x1a00+i]=path.charCodeAt(i);
  phase="open";
  var opened=n.call("open",[a+0x1a00,0,0]);
  if(opened.high!==0||opened.value<3||opened.value>1024)
    throw new Error("open_"+fmt(opened));
  fd=opened.value;
  put64(0x1800,0);put64(0x1808,1);
  put64(0x1810,a+0x1900);put64(0x1818,a+0x1920);
  dv.setInt32(0x1820,fd,true);
  phase="submit";
  var sub=n.call("sys669",[1,a+0x1800,1,3,a+0x1940,0]);
  var submit=fmt(sub),id=dv.getInt32(0x1940,true);
  var poll="not_run",state=-1,control="not_run",target="not_run";
  var targetErr=-1,controlOk=false;
  var del="not_run",delErr=-1;
  if(sub.value===0){
    cleaned=false;
    if(id<=0||id>0x10000000)throw new Error("id_invalid_"+id);
    phase="poll";
    for(var t=0;t<256;t++){
      var po=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
      poll=fmt(po);state=dv.getUint32(0x1960,true);
      if(po.value===0&&((state&0xffff)===3||(state&0xffff)===4))break;
    }
    if((state&0xffff)!==3&&(state&0xffff)!==4)
      throw new Error("not_complete_"+state);
    phase="absent_kind_control";
    var absent=n.call("sys558",[0x7fffff00,0x160,0,0,0,0]);
    control=fmt(absent);
    controlOk=absent.value===-1&&n.readErrno()===3;
    var cross={value:-1};
    if(controlOk){
      phase="completed_kind_target";
      if(api&&api.markSync)api.markSync("aio558_target_before");
      cross=n.call("sys558",[id,0x160,0,0,0,0]);
      target=fmt(cross);targetErr=cross.value===-1?n.readErrno():0;
      if(api&&api.markSync)api.markSync("aio558_target_after");
    }
    phase="delete";
    var de=n.call("sys662",[a+0x1940,1,a+0x1980,0,0,0]);
    del=fmt(de);delErr=dv.getUint32(0x1980,true);
    if(de.value===0&&(delErr===0||(cross.value===0&&delErr===0x80020003)))
      cleaned=true;
  }
  if(cleaned){
    phase="close";var cl=n.call("close",[fd]);
    if(cl.value!==0)throw new Error("close_"+fmt(cl));
    fd=-1;
  }
  var guard=true;for(var g=0x1a80;g<0x1b00;g++)if(f[g]!==0xa5)guard=false;
  var q=cleaned?n.call("getpid",[]):null;
  result={id:"aio558_completed_kind_v1",
    status:cleaned&&guard&&controlOk&&q.high===0&&q.value===p.value?"pass":"fail",
    details:{pid:p.value,submit:submit,id:id,poll:poll+"/state"+state,
      control:control,control_ok:controlOk,target:target,target_errno:targetErr,
      delete:del+"/per_id"+delErr,
      result_state:dv.getUint32(0x1928,true),cleaned:cleaned,guard:guard}};
}catch(error){result={id:"aio558_completed_kind_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180),cleaned:cleaned,fd:fd}};}
finally{
  if(f&&saved&&cleaned)for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
  if(n&&fd>=0&&cleaned)try{n.call("close",[fd]);}catch(ignore){}
}
return [result];
