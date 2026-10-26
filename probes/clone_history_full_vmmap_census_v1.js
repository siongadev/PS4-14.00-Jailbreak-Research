// Capture every current-process VM-map record before a full process dump.
var checks, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, state=window.__fw14ArrayState;
  if (!n || !n.wrappers.sysctl || !n.frame ||
      !Number.isSafeInteger(n.frameAddress) || !state ||
      state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  var frame=n.frame, address=n.frameAddress;
  if (frame.length<0x9020) throw new Error("frame_short");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1 || pid.value>100000)
    throw new Error("pid_invalid");
  var original=Array.from(frame.subarray(0x200,0x9020));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var maps=[], size=0;
  try {
    phase="vmmap";
    if (api && api.markSync) api.markSync("full_vmmap_before");
    frame.fill(0xa5,0x200,0x9020);
    dv.setUint32(0x200,32768,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,32,true);
    dv.setUint32(0x40c,pid.value,true);
    var ret=n.call("sysctl",[address+0x400,4,
      address+0x1000,address+0x200,0,0]);
    size=dv.getUint32(0x200,true);
    if (ret.value!==0 || size<136 || size>32768)
      throw new Error("vmmap_failed_"+(ret.value===-1?n.readErrno():ret.value));
    var cursor=0;
    while (cursor+136<=size && maps.length<192) {
      var at=0x1000+cursor, rec=dv.getUint32(at,true);
      if (rec<136 || rec>1160 || cursor+rec>size)
        throw new Error("vmmap_record_invalid");
      var start=dv.getUint32(at+8,true)+dv.getUint32(at+12,true)*4294967296;
      var end=dv.getUint32(at+16,true)+dv.getUint32(at+20,true)*4294967296;
      var prot=dv.getUint32(at+56,true), type=dv.getUint32(at+4,true);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
          end<=start) throw new Error("vmmap_address_invalid");
      maps.push({start:start,end:end,prot:prot,type:type});
      cursor+=rec;
    }
    if (cursor!==size) throw new Error("vmmap_not_fully_decoded");
    maps.sort(function(a,b){return a.start-b.start;});
  } finally {
    for (var x=0;x<original.length;x++) frame[0x200+x]=original[x];
  }
  var restored=original.every(function(b,i){return frame[0x200+i]===b;}) &&
    state.array[0]===state.a;
  var pidAfter=n.call("getpid",[]);
  if (!restored || pidAfter.value!==pid.value || pidAfter.high!==0)
    throw new Error("vmmap_not_restored");
  window.__fw14FullVMMap={pid:pid.value,maps:maps};
  if (api && api.markSync) api.markSync("full_vmmap_done");
  checks=[];
  for (var g=0;g<12;g++) {
    var rows=maps.slice(g*16,(g+1)*16).map(function(m){
      return m.start.toString(16)+"+"+(m.end-m.start).toString(16)+
        "/"+m.prot.toString(16)+"/"+m.type.toString(16);
    }).join("|");
    var details={rows:rows};
    if (g===0) {details.pid=pid.value;details.count=maps.length;
                 details.raw_size=size;details.restored=restored;}
    checks.push({id:"full_vmmap_"+g+"_v1",status:"pass",details:details});
  }
} catch(error) {
  checks=[];
  for (var h=0;h<12;h++) checks.push({id:"full_vmmap_"+h+"_v1",
    status:"error",details:{phase:phase,error:String(error).slice(0,180)}});
}
return checks;
