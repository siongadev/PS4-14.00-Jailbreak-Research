// Request-1 parser differential with an absent owned name. No object is
// created; this only looks for a return-code change from zeroed fields.
var result,phase="preflight",frame,saved,base=0x1800,span=0x180;
try{
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
  var rows=[],name="Fw14NoSuchMdbgObj";
  var fields=[[0,0],[0,1],[4,1],[4,0x4000],
    [8,1],[12,1],[16,1],[20,1],[24,1],[32,1]];
  function mark(s){if(api&&typeof api.markSync==="function")api.markSync(s);}
  for(var s=0;s<fields.length;s++){
    phase="field_"+s;
    frame.fill(0,base,base+0x100);
    frame.fill(0xa5,base+0x100,base+span);
    for(var j=0;j<name.length;j++)frame[base+0x28+j]=name.charCodeAt(j);
    if(s){var at=base+fields[s][0],v=fields[s][1];
      frame[at]=v&255;frame[at+1]=(v>>>8)&255;
      frame[at+2]=(v>>>16)&255;frame[at+3]=(v>>>24)&255;}
    var before=Array.from(frame.subarray(base,base+0x100));
    mark("mdbg1_field_before_"+s);
    var c=native.call("sys601",[1,native.frameAddress+base,0,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    mark("mdbg1_field_after_"+s);
    var changed=0,guard=true;
    for(var k=0;k<0x100;k++)if(frame[base+k]!==before[k])changed++;
    for(var g=base+0x100;g<base+span;g++)if(frame[g]!==0xa5)guard=false;
    rows.push(s+":"+c.value+"/"+e+"/"+changed+"/"+(guard?1:0));
  }
  var end=native.call("getpid",[]);
  result={id:"mdbg_req1_fields_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|")}};
}catch(error){result={id:"mdbg_req1_fields_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
