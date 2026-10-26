// Query selector 0's exact eight-byte output after previously safe selectors.
var result,phase="preflight",frame,original,off=0x800,len=0x40;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||!native.frame||
      !Number.isSafeInteger(native.frameAddress)||
      typeof native.wrappers.sys601!=="number")
    throw new Error("caller_missing");
  frame=native.frame;
  if(off+len+0x40>=frame.length)throw new Error("frame_small");
  original=Array.from(frame.subarray(off,off+len+0x40));
  function readStatus(){
    frame.fill(0xa5,off,off+len+0x40);
    var c=native.call("sys601",[0,native.frameAddress+off,0,0,0,0]);
    var errno=c.value===-1?native.readErrno():null;
    var hex="",changed=0,guard=true;
    for(var i=0;i<8;i++)hex+=("0"+frame[off+i].toString(16)).slice(-2);
    for(var j=0;j<len;j++)if(frame[off+j]!==0xa5)changed++;
    for(var k=off+len;k<off+len+0x40;k++)
      if(frame[k]!==0xa5)guard=false;
    if(c.value!==0||c.high!==0||changed!==8||!guard)
      throw new Error("status_output_changed_or_failed_"+errno);
    return hex;
  }
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var baseline=readStatus(),rows=[],changed=false;
  var selectors=[7,9,11,13,19,20,25,29,32];
  if(api&&typeof api.markSync==="function")
    api.markSync("mdbg_status_matrix_start");
  for(var t=0;t<selectors.length;t++){
    var num=selectors[t];phase="selector_"+num;
    var c=native.call("sys601",[num,0,0,0,0,0]);
    var e=c.value===-1?native.readErrno():null;
    var status=readStatus();
    rows.push(num+":"+c.value+"/"+(e===null?"ok":e)+":"+status);
    if(status!==baseline){changed=true;break;}
  }
  if(api&&typeof api.markSync==="function")
    api.markSync("mdbg_status_matrix_done");
  var end=native.call("getpid",[]);
  result={id:"mdbg_status_matrix_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,baseline:baseline,
      changed:changed,rows:rows.join("|")}};
}catch(error){
  result={id:"mdbg_status_matrix_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  if(frame&&original)
    for(var r=0;r<original.length;r++)frame[off+r]=original[r];
}
return [result];
