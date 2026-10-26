// Decode one-record sys548/batch_map behavior with owned zero input,
// output sentinel, and guard. Public libkernel prototype has pointer,
// count, and result pointer; the record layout remains unknown on 14.00.
var result, phase="preflight";
var frame, original, base=0x1800, span=0x280;
try {
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
  frame.fill(0,base,base+0x100);
  frame.fill(0xa5,base+0x200,base+0x240);
  frame.fill(0x5a,base+0x240,base+0x280);
  phase="call";
  if(api&&typeof api.markSync==="function")api.markSync("batch548_before");
  var c=native.call("sys548",[native.frameAddress+base,1,
    native.frameAddress+base+0x200,0,0,0]);
  var errno=c.value===-1?native.readErrno():null;
  if(api&&typeof api.markSync==="function")api.markSync("batch548_after");
  var recordChanged=0, outputChanged=0, first=-1, hex="", guard=true;
  for(var i=0;i<0x100;i++)if(frame[base+i]!==0)recordChanged++;
  for(var j=0;j<0x40;j++)if(frame[base+0x200+j]!==0xa5){
    if(first<0)first=j;outputChanged++;
  }
  if(first>=0)for(var k=0;k<16;k++)
    hex+=("0"+frame[base+0x200+first+k].toString(16)).slice(-2);
  for(var g=base+0x240;g<base+0x280;g++)
    if(frame[g]!==0x5a)guard=false;
  var end=native.call("getpid",[]);
  result={id:"batch_map_zero_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,ret:c.value,high:c.high,
      errno:errno===null?"ok":errno,record_changed:recordChanged,
      output_changed:outputChanged,first:first,hex:hex,guard:guard}};
}catch(error){result={id:"batch_map_zero_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&original)for(var r=0;r<original.length;r++)
  frame[base+r]=original[r];}
return [result];
