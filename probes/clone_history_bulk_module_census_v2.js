// Enumerate loaded 14.00 browser modules and measure each current RX base.
// The earlier 592/608 call shapes are reused; all frame bytes are restored.
var checks, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, state=window.__fw14ArrayState;
  if (!n || !state || state.array[0]!==state.a || !n.frame ||
      !Number.isSafeInteger(n.frameAddress) ||
      !n.wrappers.dynlib_list || !n.wrappers.dynlib_info_ex)
    throw new Error("native_module_plan_missing");
  var frame=n.frame, address=n.frameAddress;
  if (frame.length<0x800) throw new Error("frame_short");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1 || pid.value>100000)
    throw new Error("pid_invalid");
  var original=Array.from(frame.subarray(0x300,0x700));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var handles=[],modules=[],errors=[];
  try {
    phase="module_list";
    if (api && api.markSync) api.markSync("bulk_module_before");
    frame.fill(0xa5,0x300,0x700);
    dv.setUint32(0x300,0,true);
    dv.setUint32(0x304,0,true);
    var listed=n.call("dynlib_list",[address+0x400,64,address+0x300]);
    var count=dv.getUint32(0x300,true);
    if (listed.value!==0 || dv.getUint32(0x304,true)!==0 ||
        count<1 || count>64 || frame[0x500]!==0xa5)
      throw new Error("module_list_failed");
    for (var h=0;h<count;h++) handles.push(dv.getUint32(0x400+h*4,true));
    phase="module_info";
    for (var i=0;i<handles.length;i++) {
      frame.fill(0xa5,0x300,0x500);
      dv.setUint32(0x300,0x1a8,true);
      dv.setUint32(0x304,0,true);
      var info=n.call("dynlib_info_ex",[handles[i],0,address+0x300]);
      if (info.value!==0) {
        errors.push(handles[i].toString(16)+":"+n.readErrno());
        continue;
      }
      var name="";
      for (var j=0;j<64 && frame[0x308+j]!==0;j++)
        name+=String.fromCharCode(frame[0x308+j]);
      var base=dv.getUint32(0x410,true)+
        dv.getUint32(0x414,true)*4294967296;
      if (!name || !Number.isSafeInteger(base) ||
          base<0x10000000 || base>=0x100000000000) {
        errors.push(handles[i].toString(16)+"@"+base.toString(16)+
          ":"+name.slice(0,16));
        continue;
      }
      modules.push({handle:handles[i],name:name,base:base});
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
  }
  var restored=original.every(function(b,i){return frame[0x300+i]===b;}) &&
    state.array[0]===state.a;
  var pidAfter=n.call("getpid",[]);
  if (!restored || pidAfter.value!==pid.value || pidAfter.high!==0)
    throw new Error("module_census_not_restored");
  window.__fw14BulkModules={pid:pid.value,modules:modules};
  if (api && api.markSync) api.markSync("bulk_module_done");
  checks=[];
  for (var group=0;group<8;group++) {
    var slice=modules.slice(group*8,(group+1)*8);
    var lines=slice.map(function(m){
      return m.handle.toString(16)+"@"+m.base.toString(16)+":"+
        m.name.slice(0,40);
    }).join("|");
    checks.push({id:"bulk_modules_"+group+"_v2",
      status:errors.length===0?"pass":"fail",
      details:{pid:pid.value,total:handles.length,found:modules.length,
        rows:lines,errors:errors.join(",").slice(0,180),restored:restored}});
  }
} catch(error) {
  checks=[];
  for (var g=0;g<8;g++) checks.push({id:"bulk_modules_"+g+"_v2",
    status:"error",details:{phase:phase,error:String(error).slice(0,180)}});
}
return checks;
