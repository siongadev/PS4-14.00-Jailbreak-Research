// Bounded read-only size/flag discriminator for current number-572 wrapper.
var result,phase="preflight",frame,saved,base=0x1800,span=0x500;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys572!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1)throw new Error("pid_invalid");
  var cases=[[native.frameAddress+0x800,0,0x40],
    [native.frameAddress+0x800,0,0x80],
    [native.frameAddress+0x800,0,0x100],
    [native.frameAddress+0x800,0,0x200],
    [0,1,0x40],[0,1,0x100]];
  var rows=[];
  for(var i=0;i<cases.length;i++){
    frame.fill(0xa5,base,base+0x200);
    frame.fill(0x5a,base+0x200,base+span);
    phase="query_"+i;
    var call=native.call("sys572",[
      cases[i][0],cases[i][1],native.frameAddress+base,cases[i][2],0,0]);
    var err=call.value===-1?native.readErrno():0;
    var count=0,head=[];
    for(var j=0;j<0x200;j++)if(frame[base+j]!==0xa5){
      count++;if(head.length<6)head.push(j.toString(16)+":"+frame[base+j].toString(16));
    }
    var guard=true;
    for(var g=base+0x200;g<base+span;g++)if(frame[g]!==0x5a)guard=false;
    rows.push(i+":"+call.value+"/"+err+"/"+count+"/"+guard+"/"+head.join("."));
    if(!guard)break;
  }
  var end=native.call("getpid",[]);
  result={id:"virtual_query_size_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join(";")}};
}catch(error){result={id:"virtual_query_size_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
