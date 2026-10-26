// Read-only mmap prerequisite: anonymous control, then /dev/dce.
// Do not dereference the device mapping; unmap and close on every return.
var result,phase="preflight",native,frame,saved,fd=-1;
var base=0x1800,span=0x100,anonAddr=0,deviceAddr=0;
try{
  native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys477!=="number"||
      typeof native.wrappers.sys73!=="number"||
      typeof native.wrappers.open!=="number"||
      typeof native.wrappers.close!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  function failed(v){return v.value===-1&&v.high===0xffffffff;}
  function address(v){
    var a=(v.value>>>0)+0x100000000*v.high;
    if(!Number.isSafeInteger(a)||a<=0||a>=0x100000000000)
      throw new Error("mapped_address_out_of_range");
    return a;
  }
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1)throw new Error("pid_invalid");
  phase="anon_map";
  if(api&&typeof api.markSync==="function")api.markSync("dce_mmap_anon_before");
  var anon=native.call("sys477",[0,0x4000,1,0x1002,0xffffffff,0]);
  var anonErr=failed(anon)?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("dce_mmap_anon_after");
  if(failed(anon))throw new Error("anon_map_errno_"+anonErr);
  anonAddr=address(anon);
  phase="anon_unmap";
  var anonUnmap=native.call("sys73",[anonAddr,0x4000]);
  var anonUnmapErr=anonUnmap.value===-1?native.readErrno():0;
  if(anonUnmap.value!==0||anonUnmap.high!==0)
    throw new Error("anon_unmap_errno_"+anonUnmapErr);
  anonAddr=0;
  frame.fill(0,base,base+span);
  var path="/dev/dce";
  for(var i=0;i<path.length;i++)frame[base+i]=path.charCodeAt(i);
  phase="device_open";
  var opened=native.call("open",[native.frameAddress+base,2,0]);
  var openErr=opened.value===-1?native.readErrno():0;
  if(opened.high!==0||opened.value<0||opened.value>=1024)
    throw new Error("device_open_errno_"+openErr);
  fd=opened.value;
  phase="device_map";
  if(api&&typeof api.markSync==="function")api.markSync("dce_mmap_before");
  var mapped=native.call("sys477",[0,0x4000,1,1,fd,0]);
  var mapErr=failed(mapped)?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("dce_mmap_after");
  var mapText=failed(mapped)?"-1/"+mapErr:
    "0x"+address(mapped).toString(16)+"/0";
  var unmapText="none";
  if(!failed(mapped)){
    deviceAddr=address(mapped);
    phase="device_unmap";
    var unmapped=native.call("sys73",[deviceAddr,0x4000]);
    var unmapErr=unmapped.value===-1?native.readErrno():0;
    unmapText=unmapped.value+"/"+unmapErr;
    if(unmapped.value!==0||unmapped.high!==0)
      throw new Error("device_unmap_errno_"+unmapErr);
    deviceAddr=0;
  }
  phase="device_close";
  var closed=native.call("close",[fd]);
  var closeErr=closed.value===-1?native.readErrno():0;
  fd=-1;
  var end=native.call("getpid",[]);
  result={id:"dce_mmap_gate_v1",
    status:closed.value===0&&end.value===pid.value&&end.high===0?
      "pass":"fail",
    details:{pid:pid.value,anon:"0x"+address(anon).toString(16),
      anon_unmap:anonUnmap.value+"/"+anonUnmapErr,
      open:opened.value+"/"+openErr,device_map:mapText,
      device_unmap:unmapText,close:closed.value+"/"+closeErr}};
}catch(error){result={id:"dce_mmap_gate_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{
  if(native&&deviceAddr)try{native.call("sys73",[deviceAddr,0x4000]);}catch(ignore){}
  if(native&&anonAddr)try{native.call("sys73",[anonAddr,0x4000]);}catch(ignore){}
  if(native&&fd>=0)try{native.call("close",[fd]);}catch(ignore){}
  if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
}
return [result];
