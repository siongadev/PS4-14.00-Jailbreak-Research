var n=window.__fw14NativeInvoke,p=window.__fw14NativePlan;
var phase="preflight",result=null,tx=-1,rx=-1,f=null,saved=null;
var d={before_rcv:null,before_snd:null,set_return:null,set_errno:null,
  after_rcv:null,after_snd:null,cleanup_ok:false,guards_intact:false};
try{
  if(!n||!p||n.frame!==p.frame||!n.wrappers.socketpair||
     !n.wrappers.getsockopt||!n.wrappers.setsockopt||
     !n.wrappers.close)throw new Error("socket_option_wrappers_missing");
  f=n.frame;var v=new DataView(f.buffer),base=n.frameAddress;
  saved=Array.from(f.subarray(0x1000,0x1060));
  f.fill(0xa5,0x1000,0x1060);
  phase="socketpair";
  var pair=n.call("socketpair",[1,1,0,base+0x1000]);
  if(pair.value!==0||pair.high!==0)throw new Error("pair_failed");
  tx=v.getInt32(0x1000,true);rx=v.getInt32(0x1004,true);
  if(tx<3||rx<3||tx===rx||tx>=1024||rx>=1024)
    throw new Error("pair_fds_invalid");
  function getOpt(fd,opt){
    v.setUint32(0x1010,4,true);
    f.fill(0xa5,0x1008,0x100c);
    var got=n.call("getsockopt",[fd,0xffff,opt,base+0x1008,base+0x1010]);
    if(got.value!==0||got.high!==0||v.getUint32(0x1010,true)!==4)
      throw new Error("getsockopt_failed_"+opt);
    return v.getInt32(0x1008,true);
  }
  phase="socket_options";
  d.before_rcv=getOpt(rx,0x1002);
  d.before_snd=getOpt(tx,0x1001);
  v.setInt32(0x1020,16384,true);
  var set=n.call("setsockopt",[rx,0xffff,0x1002,base+0x1020,4]);
  d.set_return=set.value;
  if(set.value!==0||set.high!==0)d.set_errno=n.readErrno();
  d.after_rcv=getOpt(rx,0x1002);
  d.after_snd=getOpt(tx,0x1001);
  result={id:"unix_socket_buffer_v1",status:"pass",details:d};
}catch(error){
  result={id:"unix_socket_buffer_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  var cleanup=true;
  if(tx>=3){try{var c=n.call("close",[tx]);cleanup=c.value===0&&c.high===0&&cleanup;}
    catch(e){cleanup=false;}}
  if(rx>=3){try{var c2=n.call("close",[rx]);cleanup=c2.value===0&&c2.high===0&&cleanup;}
    catch(e){cleanup=false;}}
  var guard=!!f&&f.subarray(0x1050,0x1060)
    .every(function(x){return x===0xa5;});
  if(saved&&f){
    for(var i=0;i<saved.length;i++)f[0x1000+i]=saved[i];
    for(var j=0;j<saved.length;j++)if(f[0x1000+j]!==saved[j])guard=false;
  }
  result.details.cleanup_ok=cleanup;
  result.details.guards_intact=guard;
  if(!cleanup||!guard)result.status="fail";
}
return [result];
