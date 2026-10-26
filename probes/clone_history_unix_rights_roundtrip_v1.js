var n=window.__fw14NativeInvoke,p=window.__fw14NativePlan;
var phase="preflight",result=null,tx=-1,rx=-1,passed=-1;
var f=null,v=null,base=0,saved=null;
var d={send_ret:null,recv_ret:null,errno:null,control_len:null,
  cmsg_len:null,level:null,type:null,passed_fd:null,
  payload_ok:null,msg_flags:null,cleanup_ok:false,guards_intact:false};
function put64(off,num){
  v.setUint32(off,num>>>0,true);
  v.setUint32(off+4,Math.floor(num/0x100000000)>>>0,true);
}
function closeFd(fd){
  if(fd<3||fd>=1024)return false;
  var c=n.call("close",[fd]);
  return c.value===0&&c.high===0;
}
try{
  if(!n||!p||n.frame!==p.frame||!n.wrappers.socketpair||
     !n.wrappers.sendmsg||!n.wrappers.recvmsg||!n.wrappers.close)
    throw new Error("native_rights_missing");
  f=n.frame;v=new DataView(f.buffer);base=n.frameAddress;
  saved=Array.from(f.subarray(0x1000,0x1400));
  f.fill(0,0x1000,0x1400);
  f.fill(0xa5,0x13f0,0x1400);
  phase="pair";
  var pair=n.call("socketpair",[1,1,0,base+0x1000]);
  if(pair.value!==0||pair.high!==0)throw new Error("pair_failed");
  tx=v.getInt32(0x1000,true);rx=v.getInt32(0x1004,true);
  if(tx<3||rx<3||tx===rx||tx>=1024||rx>=1024)
    throw new Error("pair_fds_invalid");
  phase="send_right";
  for(var i=0;i<16;i++)f[0x1100+i]=0x41+i;
  put64(0x1040+16,base+0x1080);
  v.setInt32(0x1040+24,1,true);
  put64(0x1040+32,base+0x1120);
  v.setUint32(0x1040+40,24,true);
  put64(0x1080,base+0x1100);put64(0x1088,16);
  v.setUint32(0x1120,20,true);
  v.setInt32(0x1124,0xffff,true);
  v.setInt32(0x1128,1,true);
  v.setInt32(0x1130,tx,true);
  var send=n.call("sendmsg",[tx,base+0x1040,0]);
  d.send_ret=send.value;
  if(send.value!==16||send.high!==0)
    throw new Error("sendmsg_failed_"+n.readErrno());
  phase="receive_right";
  f.fill(0xa5,0x1200,0x1300);
  f.fill(0,0x1200,0x1230);
  put64(0x1200+16,base+0x1240);
  v.setInt32(0x1200+24,1,true);
  put64(0x1200+32,base+0x12a0);
  v.setUint32(0x1200+40,24,true);
  put64(0x1240,base+0x1280);put64(0x1248,16);
  var recv=n.call("recvmsg",[rx,base+0x1200,0x80]);
  d.recv_ret=recv.value;d.errno=n.readErrno();
  d.control_len=v.getUint32(0x1200+40,true);
  d.msg_flags=v.getInt32(0x1200+44,true);
  d.cmsg_len=v.getUint32(0x12a0,true);
  d.level=v.getInt32(0x12a4,true);
  d.type=v.getInt32(0x12a8,true);
  passed=v.getInt32(0x12b0,true);
  d.passed_fd=passed;
  d.payload_ok=recv.value===16;
  for(var j=0;j<16&&d.payload_ok;j++)
    if(f[0x1280+j]!==0x41+j)d.payload_ok=false;
  var valid=recv.value===16&&d.control_len>=20&&
    d.cmsg_len>=20&&d.level===0xffff&&d.type===1&&
    passed>=3&&passed<1024&&d.payload_ok;
  result={id:"unix_rights_roundtrip_v1",status:valid?"pass":"fail",
    details:d};
}catch(error){
  result={id:"unix_rights_roundtrip_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  var cleanup=true;
  if(passed>=3&&passed<1024&&passed!==tx&&passed!==rx){
    try{cleanup=closeFd(passed)&&cleanup;}catch(e){cleanup=false;}
  }
  if(tx>=3){try{cleanup=closeFd(tx)&&cleanup;}catch(e){cleanup=false;}}
  if(rx>=3){try{cleanup=closeFd(rx)&&cleanup;}catch(e){cleanup=false;}}
  var guard=!!f&&f.subarray(0x13f0,0x1400)
    .every(function(x){return x===0xa5;});
  if(saved&&f){
    for(var k=0;k<saved.length;k++)f[0x1000+k]=saved[k];
    for(var q=0;q<saved.length;q++)
      if(f[0x1000+q]!==saved[q])guard=false;
  }
  result.details.cleanup_ok=cleanup;
  result.details.guards_intact=guard;
  if(!cleanup||!guard)result.status="fail";
}
return [result];
