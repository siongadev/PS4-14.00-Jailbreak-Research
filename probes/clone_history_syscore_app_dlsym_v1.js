// Resolve libSceSysCore's exported sceApplication* names without calling them.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.dynlib_dlsym ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("dlsym_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x620 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var symbols=[
    [28,"sceApplicationInitialize"],
    [28,"sceApplicationExitSpawn"],
    [28,"sceApplicationExitSpawn2"],
    [28,"sceApplicationExitSpawn3"],
    [28,"sceApplicationAddProcess2"],
    [28,"sceApplicationGetProcs"],
    [28,"sceApplicationSetApplicationFocus"],
    [28,"sceApplicationKill"],
    [28,"sceApplicationLocalProcessKill"],
    [28,"sceApplicationRaiseExceptionToPid"]
  ];
  var entries=[],guardIntact=true,restored=true,contractIntact=true;
  phase="symbol_resolution";
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_dlsym_preflight");
  for (var n=0;n<symbols.length;n++) {
    var original=Array.from(frame.subarray(0x300,0x620));
    var returned,errno=0,pointer=0,valid=false;
    try {
      frame.fill(0xa5,0x300,0x620);
      dv.setUint32(0x300,0,true);
      dv.setUint32(0x304,0,true);
      for (var i=0;i<symbols[n][1].length;i++)
        frame[0x400+i]=symbols[n][1].charCodeAt(i);
      frame[0x400+symbols[n][1].length]=0;
      returned=native.call("dynlib_dlsym",[
        symbols[n][0],address+0x400,address+0x300]);
      if (returned.value===-1) errno=native.readErrno();
      pointer=dv.getUint32(0x300,true)+
        dv.getUint32(0x304,true)*0x100000000;
      valid=returned.value===-1 ||
        (returned.value===0 && Number.isSafeInteger(pointer) &&
         pointer>=0x100000000 && pointer<0x1000000000000);
      if (!valid) contractIntact=false;
      if (frame[0x308]!==0xa5 || frame[0x3ff]!==0xa5 ||
          frame[0x500]!==0xa5 || frame[0x61f]!==0xa5)
        guardIntact=false;
    } finally {
      for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
    }
    if (!original.every(function (byte,offset) {
      return frame[0x300+offset]===byte;
    })) restored=false;
    entries.push(symbols[n][1]+":"+returned.value+":"+
      (returned.value===0?"0x"+pointer.toString(16):"errno"+errno));
    if (!guardIntact || !restored || !contractIntact) break;
  }
  restored=restored && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_dlsym_restored");
  result={id:"syscore_app_dlsym_v1",
    status:guardIntact && restored && contractIntact &&
      entries.length===symbols.length?"pass":"fail",
    details:{self_pid:self.value,
      entries:entries.join(";"),guard_intact:guardIntact,
      carrier_restored:restored,contract_intact:contractIntact}};
} catch (error) {
  result={id:"syscore_app_dlsym_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
