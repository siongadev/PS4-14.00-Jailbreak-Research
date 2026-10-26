// The remaining four zero-input/four-byte-output 14.00 NetCtl methods.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!n||!s||!m||!f||s.array[0]!==s.a||
     !Number.isSafeInteger(n.frameAddress)||f.length<0x700)
    throw new Error("plan_missing");
  var names=["netctl_m07","netctl_m08","netctl_m09","netctl_m17"];
  for(var t=0;t<names.length;t++)if(!n.wrappers[names[t]])
    throw new Error("wrapper_missing_"+names[t]);
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var rows=[],guarded=true,restored=true;
  for(var c=0;c<names.length;c++){
    var o=0x500+c*0x20,z=4,g=12;
    var saved=Array.from(f.subarray(o,o+z+g));
    var call=null,bytes=[];
    try{
      f.fill(0xa5,o,o+z);
      f.fill(0x5a,o+z,o+z+g);
      phase=names[c];
      if(api&&api.markSync)api.markSync(names[c]+"_before");
      call=n.call(names[c],[n.frameAddress+o]);
      bytes=Array.from(f.subarray(o,o+z));
      guarded=guarded&&Array.from(f.subarray(o+z,o+z+g))
        .every(function(v){return v===0x5a;});
    }finally{for(var k=0;k<saved.length;k++)f[o+k]=saved[k];}
    restored=restored&&saved.every(function(v,i){return f[o+i]===v;});
    var hex=bytes.map(function(v){return (v<16?"0":"")+v.toString(16);}).join("");
    rows.push(names[c]+":"+(call.value>>>0).toString(16)+":"+hex);
  }
  var after=n.call("getpid",[]);
  restored=restored&&after.high===0&&after.value===pid.value&&s.array[0]===s.a;
  result={id:"netctl_four_outputs_v1",status:restored&&guarded?"pass":"fail",
    details:{pid:pid.value,rows:rows.join(","),guarded:guarded,restored:restored}};
}catch(error){result={id:"netctl_four_outputs_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
