// Check the current PS4 14.00 query_memory_protection shape using an
// address in the caller's owned native frame and three guarded outputs.
var result,phase="preflight",frame,saved,base=0x1800,span=0x180;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys547!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function hex(off,n){var s="";for(var i=0;i<n;i++)
    s+=("0"+frame[off+i].toString(16)).slice(-2);return s;}
  function mark(s){if(api&&typeof api.markSync==="function")api.markSync(s);}
  var rows=[];
  for(var j=0;j<2;j++){
    phase="query_"+j;
    frame.fill(0xa5,base,base+0x40);
    frame.fill(0x5a,base+0x40,base+span);
    var address=j===0?native.frameAddress+base+0x100:0;
    mark("qprot_before_"+j);
    var c=native.call("sys547",[address,native.frameAddress+base,
      native.frameAddress+base+8,native.frameAddress+base+16,0,0]);
    var e=c.value===-1?native.readErrno():0;
    mark("qprot_after_"+j);
    var guard=true;
    for(var g=base+0x40;g<base+0x100;g++)if(frame[g]!==0x5a)guard=false;
    rows.push(j+":"+c.value+"/"+e+"/"+
      hex(base,20)+"/"+(guard?1:0));
  }
  var end=native.call("getpid",[]);
  result={id:"query_protection_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|")}};
}catch(error){result={id:"query_protection_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
