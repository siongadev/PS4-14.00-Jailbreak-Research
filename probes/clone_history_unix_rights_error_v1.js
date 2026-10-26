// Unix SOCK_STREAM descriptor-passing error path, with native limit restore.
var native=window.__fw14NativeInvoke;
var plan=window.__fw14NativePlan;
var state=window.__fw14ArrayState;
var phase="preflight", result=null;
var sender=-1,receiver=-1,received=[];
var limitLowered=false,originalLimit=null;
var report={send_ret:null,payload_ok:null,limit_before:null,
  lower_ret:null,first_recv:null,first_errno:null,
  restore_ret:null,second_recv:null,second_errno:null,
  right_fd:null,cleanup_ok:false,guards_intact:false};
var saved=null,frame=null,view=null,base=0;
function ptr(off){return base+off;}
function putPtr(off,value){
  view.setUint32(off,value>>>0,true);
  view.setUint32(off+4,Math.floor(value/0x100000000)>>>0,true);
}
function checkZero(call){return call.value===0&&call.high===0;}
function closeFd(fd){
  if(fd<3||fd>=1024)return false;
  var c=native.call("close",[fd]);
  return checkZero(c);
}
function msg(off,iovOff,dataOff,dataLen,controlOff,controlLen){
  frame.fill(0,off,off+48);
  putPtr(off+16,ptr(iovOff));
  view.setInt32(off+24,1,true);
  putPtr(off+32,ptr(controlOff));
  view.setUint32(off+40,controlLen,true);
  putPtr(iovOff,ptr(dataOff));
  putPtr(iovOff+8,dataLen);
}
function rightFrom(controlOff,msgOff){
  var len=view.getUint32(msgOff+40,true);
  if(len<20||len>24)return -1;
  if(view.getUint32(controlOff,true)<20||
     view.getInt32(controlOff+4,true)!==0xffff||
     view.getInt32(controlOff+8,true)!==1)return -1;
  return view.getInt32(controlOff+16,true);
}
try{
  if(!native||!plan||!state||native.frame!==plan.frame||
     !native.wrappers||!native.wrappers.sendmsg||
     !native.wrappers.recvmsg||!native.wrappers.getrlimit||
     !native.wrappers.setrlimit||!native.wrappers.socketpair||
     !native.wrappers.write||!native.wrappers.close||
     typeof native.readErrno!=="function")
    throw new Error("rights_native_setup_missing");
  frame=native.frame;
  base=native.frameAddress;
  if(frame.length<0x3000||!Number.isSafeInteger(base))
    throw new Error("rights_frame_invalid");
  view=new DataView(frame.buffer);
  saved=Array.from(frame.subarray(0x1000,0x3000));
  frame.fill(0,0x1000,0x3000);
  frame.fill(0xa5,0x2ff0,0x3000);
  phase="socketpair";
  var pair=native.call("socketpair",[1,1,0,ptr(0x1000)]);
  if(!checkZero(pair))throw new Error("rights_socketpair_failed");
  sender=view.getInt32(0x1000,true);
  receiver=view.getInt32(0x1004,true);
  if(sender<3||receiver<3||sender===receiver||
     sender>=1024||receiver>=1024)
    throw new Error("rights_fds_invalid");
  phase="send_rights";
  for(var i=0;i<16;i++)frame[0x1100+i]=0x41+i;
  msg(0x1040,0x1080,0x1100,16,0x1120,24);
  view.setUint32(0x1120,20,true);
  view.setInt32(0x1124,0xffff,true);
  view.setInt32(0x1128,1,true);
  view.setInt32(0x1130,sender,true);
  var sent=native.call("sendmsg",[sender,ptr(0x1040),0]);
  report.send_ret=sent.value;
  if(sent.value!==16||sent.high!==0)
    throw new Error("rights_sendmsg_failed_"+native.readErrno());
  frame.fill(0x42,0x1800,0x2000);
  var tail=native.call("write",[sender,ptr(0x1800),2048]);
  if(tail.value!==2048||tail.high!==0)
    throw new Error("rights_tail_write_failed");
  phase="limit_lower";
  var got=native.call("getrlimit",[8,ptr(0x1140)]);
  if(!checkZero(got))throw new Error("rights_getrlimit_failed");
  originalLimit=Array.from(frame.subarray(0x1140,0x1150));
  report.limit_before=view.getUint32(0x1140,true);
  for(var j=0;j<16;j++)frame[0x1160+j]=originalLimit[j];
  view.setUint32(0x1160,1,true);
  view.setUint32(0x1164,0,true);
  var lower=native.call("setrlimit",[8,ptr(0x1160)]);
  report.lower_ret=lower.value;
  if(!checkZero(lower))
    throw new Error("rights_setrlimit_failed_"+native.readErrno());
  limitLowered=true;
  phase="receive_error";
  frame.fill(0xa5,0x1200,0x1300);
  msg(0x1200,0x1240,0x1280,16,0x12a0,24);
  var first=native.call("recvmsg",[receiver,ptr(0x1200),0x80]);
  report.first_recv=first.value;
  report.first_errno=native.readErrno();
  var firstRight=rightFrom(0x12a0,0x1200);
  if(firstRight>=3&&firstRight<1024)received.push(firstRight);
  phase="limit_restore";
  for(var k=0;k<16;k++)frame[0x1160+k]=originalLimit[k];
  var restore=native.call("setrlimit",[8,ptr(0x1160)]);
  report.restore_ret=restore.value;
  if(!checkZero(restore))throw new Error("rights_restore_failed");
  limitLowered=false;
  phase="receive_after_error";
  frame.fill(0xa5,0x1300,0x1400);
  msg(0x1300,0x1340,0x1380,16,0x13a0,24);
  var second=native.call("recvmsg",[receiver,ptr(0x1300),0x80]);
  report.second_recv=second.value;
  report.second_errno=native.readErrno();
  if(second.value>0){
    report.payload_ok=true;
    for(var p=0;p<Math.min(second.value,16);p++)
      if(frame[0x1380+p]!==0x41+p)report.payload_ok=false;
  }
  var secondRight=rightFrom(0x13a0,0x1300);
  if(secondRight>=3&&secondRight<1024){
    received.push(secondRight);
    report.right_fd=secondRight;
  }
  var expectedError=first.value===-1&&report.first_errno===24;
  result={id:"unix_rights_error_v1",status:expectedError?"pass":"fail",
    details:report};
}catch(error){
  result={id:"unix_rights_error_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  var cleanupOk=true;
  if(limitLowered&&originalLimit){
    try{
      for(var a=0;a<16;a++)frame[0x1160+a]=originalLimit[a];
      cleanupOk=checkZero(native.call("setrlimit",[8,ptr(0x1160)]))&&cleanupOk;
      limitLowered=false;
    }catch(e){cleanupOk=false;}
  }
  for(var r=0;r<received.length;r++){
    try{cleanupOk=closeFd(received[r])&&cleanupOk;}
    catch(e){cleanupOk=false;}
  }
  for(var q=0;q<2;q++){
    var fd=q===0?sender:receiver;
    if(fd>=3){
      try{cleanupOk=closeFd(fd)&&cleanupOk;}
      catch(e){cleanupOk=false;}
    }
  }
  var guardOk=!!frame&&frame.subarray(0x2ff0,0x3000)
    .every(function(x){return x===0xa5;});
  if(saved&&frame){
    for(var z=0;z<saved.length;z++)frame[0x1000+z]=saved[z];
    for(var y=0;y<saved.length;y++)
      if(frame[0x1000+y]!==saved[y])guardOk=false;
  }
  if(!result)result={id:"unix_rights_error_v1",status:"error",
    details:{phase:phase,error:"no_result"}};
  result.details.cleanup_ok=cleanupOk;
  result.details.guards_intact=guardOk;
  if(!cleanupOk||!guardOk)result.status="fail";
}
return [result];
