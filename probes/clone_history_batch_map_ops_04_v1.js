// Brute first u32 in one zeroed sys548 batch-map record, operations 4..7.
// Uses the public pointer/count/result-pointer call shape. The record
// interpretation is a hypothesis until a 14.00 differential appears.
var result,phase="preflight",frame,original,base=0x1800,span=0x280;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys548!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  original=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function mark(s){try{if(api&&typeof api.markSync==="function")
    api.markSync(s);}catch(_){}}
  var rows=[], START=4;
  mark("bm04_start");
  for(var op=START;op<START+4;op++){
    phase="op_"+op;
    frame.fill(0,base,base+0x100);
    frame[base]=op;
    frame.fill(0xa5,base+0x200,base+0x240);
    frame.fill(0x5a,base+0x240,base+0x280);
    mark("bm04_before_"+op);
    var c=native.call("sys548",[native.frameAddress+base,1,
      native.frameAddress+base+0x200,0,0,0]);
    var e=c.value===-1?native.readErrno():null;
    var changed=0,guard=true;
    for(var i=0;i<0x40;i++)
      if(frame[base+0x200+i]!==0xa5)changed++;
    for(var j=base+0x240;j<base+0x280;j++)
      if(frame[j]!==0x5a)guard=false;
    rows.push(op+":"+c.value+"/"+(e===null?"ok":e)+
      "/"+changed+"/"+(guard?1:0));
  }
  var end=native.call("getpid",[]);
  result={id:"batch_map_ops_04_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|")}};
}catch(error){result={id:"batch_map_ops_04_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&original)for(var r=0;r<original.length;r++)
  frame[base+r]=original[r];}
return [result];

