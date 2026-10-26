// Completed two-request AIO object: delete one ID, repeat that ID, and
// check whether the sibling remains valid before final cleanup.
var result,phase="preflight",n=null,f=null,saved=null,fd=-1,safe=true;
try{
  n=window.__fw14NativeInvoke;
  var s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.frame||n.frame.length<0x1b00||
     !Number.isSafeInteger(n.frameAddress)||!s||s.array[0]!==s.a||
     [669,664,662].some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
    throw new Error("plan_missing");
  f=n.frame;var a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  saved=Array.from(f.subarray(0x1800,0x1b00));
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength),guard=true;
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
  for(var ri=0;ri<2;ri++){
    var ro=0x1800+ri*0x28;
    put64(ro,0);put64(ro+8,1);
    put64(ro+16,a+0x1900+ri);
    put64(ro+24,a+0x1920+ri*0x10);
    dv.setInt32(ro+32,fd,true);
  }
  phase="submit";
  if(api&&api.markSync)api.markSync("aio_multi2_submit_before");
  var sub=n.call("sys669",[0x1001,a+0x1800,2,3,a+0x1940,0]);
  var submit=fmt(sub),ids=[dv.getInt32(0x1940,true),dv.getInt32(0x1944,true)];
  var poll="not_run",first="not_run",duplicate="not_run";
  var siblingDelete="not_run",firstErr=-1,duplicateErr=-1,siblingErr=-1;
  var siblingState=-1,polls=0,states=[0,0],res=[0,0];
  if(sub.value===0){
    safe=false;
    if(ids.some(function(v){return v<=0||v>0x10000000;}))
      throw new Error("ids_invalid_"+ids.join(","));
    phase="poll";
    if(api&&api.markSync)api.markSync("aio_multi2_poll_before");
    for(var t=0;t<8;t++){
      var pc=n.call("sys664",[a+0x1940,2,a+0x1960,0,0,0]);
      poll=fmt(pc);polls++;
      states=[dv.getUint32(0x1960,true),dv.getUint32(0x1964,true)];
      res=[dv.getUint32(0x1928,true),dv.getUint32(0x1938,true)];
      if(states.every(function(v){return v===3||v===4;})||
         res.every(function(v){return v===3||v===4;}))break;
    }
    if(states.every(function(v){return v===3||v===4;})||
       res.every(function(v){return v===3||v===4;})){
      phase="first_delete";
      if(api&&api.markSync)api.markSync("aio_dup_first_before");
      var dc=n.call("sys662",[a+0x1940,1,a+0x1980,0,0,0]);
      first=fmt(dc);firstErr=dv.getUint32(0x1980,true);
      if(dc.value===0&&firstErr===0){
        if(api&&api.markSync)api.markSync("aio_dup_first_done");
        phase="duplicate_delete";
        if(api&&api.markSync)api.markSync("aio_dup_second_before");
        var dd=n.call("sys662",[a+0x1940,1,a+0x1984,0,0,0]);
        duplicate=fmt(dd);duplicateErr=dv.getUint32(0x1984,true);
        // A second successful deletion with per-ID success would be an
        // anomaly. Leave the object and frame alone for follow-up.
        if(dd.value!==0||duplicateErr!==0){
          phase="sibling_poll";
          var sp=n.call("sys664",[a+0x1944,1,a+0x1964,0,0,0]);
          siblingState=dv.getUint32(0x1964,true);
          if(sp.value===0&&(siblingState===3||siblingState===4)){
            phase="sibling_delete";
            if(api&&api.markSync)api.markSync("aio_dup_sibling_before");
            var sd=n.call("sys662",[a+0x1944,1,a+0x1988,0,0,0]);
            siblingDelete=fmt(sd);siblingErr=dv.getUint32(0x1988,true);
            if(sd.value===0&&siblingErr===0)safe=true;
          }
        }
      }
    }
  }
  for(var g=0x1a80;g<0x1b00;g++)if(f[g]!==0xa5)guard=false;
  if(safe){
    phase="close";var cc=n.call("close",[fd]);
    if(cc.value!==0)throw new Error("close_"+fmt(cc));
    fd=-1;
  }
  var q=safe?n.call("getpid",[]):null;
  result={id:"aio669_duplicate_delete_v1",
    status:safe&&guard&&q.high===0&&q.value===p.value?"pass":"fail",
    details:{pid:p.value,submit:submit,ids:ids.join(","),
      first:first,first_error:firstErr,duplicate:duplicate,
      duplicate_error:duplicateErr,sibling_state:siblingState,
      sibling_delete:siblingDelete,sibling_error:siblingErr,
      guard:guard,cleaned:safe}};
}catch(error){result={id:"aio669_duplicate_delete_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180),fd:fd,cleaned:safe}};}
finally{
  if(f&&saved&&safe)for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
  if(n&&fd>=0&&safe)try{n.call("close",[fd]);}catch(ignore){}
}
return [result];
