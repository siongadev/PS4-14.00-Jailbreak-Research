// Compare request 1 with an absent name and a self-created 0x4000 object.
// Both calls use the same owned, zero-initialized request buffer. The object
// is deleted with its measured kind, and every modified frame byte is restored.
var result, phase="preflight", live=0, frame=null, savedName=null, savedRequest=null;
var native=window.__fw14NativeInvoke, state=window.__fw14ArrayState;
var cleanupValue=null, cleanupErrno=null;
try {
  if(!native||!native.wrappers||!native.wrappers.sys557||
     !native.wrappers.sys558||!native.wrappers.sys601||
     !native.frame||!Number.isSafeInteger(native.frameAddress)||
     !state||state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  frame=native.frame;
  var nameOff=0x200, reqOff=0x800, reqPtr=native.frameAddress+reqOff+0x20;
  if(frame.length<0x920)throw new Error("frame_too_small");
  savedName=Array.from(frame.subarray(nameOff,nameOff+32));
  savedRequest=Array.from(frame.subarray(reqOff,reqOff+0x120));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var name="Fw14Owned601";
  frame.fill(0,nameOff,nameOff+32);
  frame.fill(0xa5,reqOff,reqOff+0x120);
  frame.fill(0,reqOff+0x20,reqOff+0x20+0x80);
  for(var i=0;i<name.length;i++){
    frame[nameOff+i]=name.charCodeAt(i);
    frame[reqOff+0x20+0x28+i]=name.charCodeAt(i);
  }
  var expected=Array.from(frame.subarray(reqOff+0x20,reqOff+0x20+0x80));
  function countChanged(){
    var n=0;
    for(var j=0;j<expected.length;j++)
      if(frame[reqOff+0x20+j]!==expected[j])n++;
    return n;
  }
  function restoreInput(){
    for(var j=0;j<expected.length;j++)frame[reqOff+0x20+j]=expected[j];
  }
  phase="absent_request";
  if(api&&typeof api.markSync==="function")api.markSync("mdbg1_absent_before");
  var absent=native.call("sys601",[1,reqPtr,0,0,0,0]);
  var absentErrno=absent.value===-1?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("mdbg1_absent_after");
  var absentChanged=countChanged();
  restoreInput();
  phase="create";
  var created=native.call("sys557",[native.frameAddress+nameOff,0,0x4000,0,0,0]);
  var createErrno=created.value===-1?native.readErrno():0;
  if(created.value>0&&created.value<0x1000000)live=created.value;
  if(!live)throw new Error("owned_create_failed_"+createErrno);
  phase="owned_request";
  if(api&&typeof api.markSync==="function")api.markSync("mdbg1_owned_before");
  var owned=native.call("sys601",[1,reqPtr,0,0,0,0]);
  var ownedErrno=owned.value===-1?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("mdbg1_owned_after");
  var ownedChanged=countChanged();
  phase="cleanup";
  var del=native.call("sys558",[live,0x4000,0,0,0,0]);
  cleanupValue=del.value;
  cleanupErrno=del.value===-1?native.readErrno():0;
  if(del.value===0)live=0;
  if(api&&typeof api.markSync==="function")api.markSync("mdbg1_owned_cleanup");
  var guards=frame[reqOff]===0xa5&&frame[reqOff+0x1f]===0xa5&&
    frame[reqOff+0xa0]===0xa5&&frame[reqOff+0x11f]===0xa5;
  var end=native.call("getpid",[]);
  var pidOk=end.high===0&&end.value===pid.value&&state.array[0]===state.a;
  result={id:"namedobj_mdbg1_owned_compare_v1",
    status:(!live&&guards&&pidOk)?"pass":"fail",
    details:{pid:pid.value,absent:absent.value+"/"+absentErrno,
      absent_changed:absentChanged,create:created.value,
      owned:owned.value+"/"+ownedErrno,
      owned_changed:ownedChanged,
      cleanup:cleanupValue+"/"+cleanupErrno,
      guards:guards,pid_ok:pidOk}};
}catch(error){
  result={id:"namedobj_mdbg1_owned_compare_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180),live_handle:live}};
}finally{
  if(live&&native&&native.wrappers&&native.wrappers.sys558){
    try{
      var last=native.call("sys558",[live,0x4000,0,0,0,0]);
      cleanupValue=last.value;
      cleanupErrno=last.value===-1?native.readErrno():0;
      if(last.value===0)live=0;
    }catch(ignore){}
  }
  if(frame&&savedName)
    for(var x=0;x<savedName.length;x++)frame[0x200+x]=savedName[x];
  if(frame&&savedRequest)
    for(var y=0;y<savedRequest.length;y++)frame[0x800+y]=savedRequest[y];
}
if(result&&result.details&&frame&&savedName&&savedRequest){
  var restored=true;
  for(var k=0;k<savedName.length;k++)
    if(frame[0x200+k]!==savedName[k])restored=false;
  for(var z=0;z<savedRequest.length;z++)
    if(frame[0x800+z]!==savedRequest[z])restored=false;
  result.details.restored=restored;
  if(!restored&&result.status==="pass")result.status="fail";
  if(result.status==="error")result.details.live_handle=live;
}
return [result];
