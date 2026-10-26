// Matched loader control for a libc path embedded in the captured
// 14.00 libSceSysmodule client.
// Uses the four-argument 14.00 Sysmodule call shape and unloads only a
// newly returned handle that was absent from the initial module list.
var result,phase="preflight",saved=null;
try {
  var n=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if(!n || !state || state.array[0]!==state.a || !n.frame ||
     !Number.isSafeInteger(n.frameAddress) || n.frame.length<0x900 ||
     !n.wrappers || !n.wrappers.sys594 || !n.wrappers.sys595 ||
     !n.wrappers.dynlib_list)
    throw new Error("native_plan_missing");
  var frame=n.frame,address=n.frameAddress;
  var beforePid=n.call("getpid",[]);
  if(beforePid.high!==0 || beforePid.value<1 || beforePid.value>100000)
    throw new Error("pid_control_failed");
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  saved=Array.from(frame.subarray(0x300,0x900));
  function listHandles(){
    frame.fill(0xa5,0x700,0x900);
    dv.setUint32(0x700,0,true);
    dv.setUint32(0x704,0,true);
    var call=n.call("dynlib_list",[address+0x780,64,address+0x700]);
    var count=dv.getUint32(0x700,true),handles=[];
    if(call.value!==0 || call.high!==0 || count<1 || count>64)
      throw new Error("module_list_failed:"+call.value+"/"+count);
    for(var i=0;i<count;i++)handles.push(dv.getUint32(0x780+i*4,true));
    return handles;
  }
  phase="initial_list";
  var oldHandles=listHandles();
  if(oldHandles.indexOf(8193)<0)throw new Error("browser_libkernel_missing");
  var paths=["libc.sprx","/system/common/lib/libc.sprx"];
  var rows=[],cleanup="none",guard=true,newHandle=0;
  for(var p=0;p<paths.length;p++){
    phase="load_"+p;
    frame.fill(0xa5,0x300,0x600);
    dv.setUint32(0x300,0,true);
    dv.setUint32(0x304,0,true);
    for(var k=0;k<paths[p].length;k++)frame[0x400+k]=paths[p].charCodeAt(k);
    frame[0x400+paths[p].length]=0;
    if(api && api.markSync)api.markSync(p===0?"libc_load_before_bare":"libc_load_before_absolute");
    var call=n.call("sys594",[address+0x400,0,address+0x300,0]);
    var errno=call.value===-1?n.readErrno():0;
    var handle=dv.getUint32(0x300,true);
    guard=guard && frame[0x308]===0xa5 && frame[0x3ff]===0xa5 &&
      frame[0x500]===0xa5 && frame[0x5ff]===0xa5;
    rows.push(p+":"+call.value+"/"+errno+"/"+handle);
    if(api && api.markSync)api.markSync(p===0?"libc_load_after_bare":"libc_load_after_absolute");
    if(call.value===0){
      if(handle===0)throw new Error("success_without_handle");
      if(oldHandles.indexOf(handle)>=0){
        cleanup="existing_handle_not_unloaded";
      }else{
        newHandle=handle;
        phase="unload_new";
        var unload=n.call("sys595",[handle]);
        cleanup="new_handle_unload:"+unload.value+
          (unload.value===-1?"/"+n.readErrno():"");
      }
      break;
    }
    if(call.value!==-1)throw new Error("unexpected_load_return:"+call.value);
  }
  phase="final_list";
  var finalHandles=listHandles();
  var added=finalHandles.filter(function(v){return oldHandles.indexOf(v)<0;});
  var afterPid=n.call("getpid",[]);
  for(var s=0;s<saved.length;s++)frame[0x300+s]=saved[s];
  var restored=afterPid.high===0 && afterPid.value===beforePid.value &&
    saved.every(function(v,i){return frame[0x300+i]===v;}) &&
    state.array[0]===state.a;
  result={id:"libc_load_control_v1",status:restored && guard?"pass":"fail",
    details:{pid:beforePid.value,before_count:oldHandles.length,
      outcomes:rows.join("|"),cleanup:cleanup,
      after_count:finalHandles.length,added:added.join(","),
      new_handle:newHandle,guard:guard,restored:restored}};
}catch(error){
  if(saved && frame)for(var q=0;q<saved.length;q++)frame[0x300+q]=saved[q];
  result={id:"libc_load_control_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
