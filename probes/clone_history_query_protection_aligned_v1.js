// Distinguish address alignment from the earlier sys547 EINVAL response.
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
  var rows=[],raw=native.frameAddress+0x1000;
  var addresses=[Math.floor(raw/4096)*4096,Math.floor(raw/16384)*16384];
  for(var j=0;j<addresses.length;j++){
    phase="aligned_"+j;
    frame.fill(0xa5,base,base+0x40);
    frame.fill(0x5a,base+0x40,base+span);
    mark("qprot_align_before_"+j);
    var c=native.call("sys547",[addresses[j],native.frameAddress+base,
      native.frameAddress+base+8,native.frameAddress+base+16,0,0]);
    var e=c.value===-1?native.readErrno():0;
    mark("qprot_align_after_"+j);
    var changed=0,guard=true;
    for(var i=0;i<0x20;i++)if(frame[base+i]!==0xa5)changed++;
    for(var g=base+0x40;g<base+span;g++)if(frame[g]!==0x5a)guard=false;
    rows.push(j+":"+c.value+"/"+e+"/"+changed+
      "/"+hex(base,20)+"/"+(guard?1:0));
  }
  var end=native.call("getpid",[]);
  result={id:"query_protection_aligned_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,delta4k:addresses[0]-native.frameAddress,
      delta16k:addresses[1]-native.frameAddress,rows:rows.join("|")}};
}catch(error){result={id:"query_protection_aligned_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
