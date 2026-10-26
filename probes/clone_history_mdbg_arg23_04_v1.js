// Determine whether request 4 uses either of two owned user buffers.
// Pointer values are derived from the current page's calibrated frame.
var result, phase="preflight", frame, saved, base=0x1800, span=0x300;
try {
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys601!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function mark(s){if(api&&typeof api.markSync==="function")api.markSync(s);}
  function changes(off,seed){var n=0;
    for(var i=0;i<0x100;i++)if(frame[off+i]!==((i*3+seed)&255))n++;
    return n;}
  var rows=[],p2=native.frameAddress+base,p3=native.frameAddress+base+0x100;
  var shapes=[[0,p3,0],[p2,p3,0],[p2,p3,0x100],[p2,0,0x100]];
  for(var s=0;s<shapes.length;s++){
    phase="shape_"+s;
    for(var j=0;j<0x100;j++){
      frame[base+j]=(j*3+17)&255;
      frame[base+0x100+j]=(j*3+91)&255;
    }
    frame.fill(0x5a,base+0x200,base+span);
    mark("mdbg4_a23_before_"+s);
    var a=shapes[s],c=native.call("sys601",[4,a[0],a[1],a[2],0,0]);
    var e=c.value===-1?native.readErrno():0;
    mark("mdbg4_a23_after_"+s);
    var guard=true;
    for(var k=base+0x200;k<base+span;k++)if(frame[k]!==0x5a)guard=false;
    rows.push(s+":"+c.value+"/"+e+"/"+
      changes(base,17)+"/"+changes(base+0x100,91)+"/"+(guard?1:0));
  }
  var end=native.call("getpid",[]);
  result={id:"mdbg_arg23_04_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|")}};
}catch(error){result={id:"mdbg_arg23_04_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
