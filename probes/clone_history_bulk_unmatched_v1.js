// Resolve the three module-info pointers that did not lie in RX/type-9 maps.
var result, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, state=window.__fw14ArrayState;
  var census=window.__fw14BulkModules;
  if (!n || !n.wrappers.sysctl || !n.frame || !state ||
      state.array[0]!==state.a || !census || !census.modules)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.value!==census.pid || pid.high!==0) throw new Error("pid_changed");
  var frame=n.frame, address=n.frameAddress;
  var original=Array.from(frame.subarray(0x200,0x9020));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var maps=[];
  try {
    phase="vmmap";
    frame.fill(0xa5,0x200,0x9020);
    dv.setUint32(0x200,32768,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,32,true);
    dv.setUint32(0x40c,pid.value,true);
    var c=n.call("sysctl",[address+0x400,4,
      address+0x1000,address+0x200,0,0]);
    var size=dv.getUint32(0x200,true);
    if (c.value!==0 || size<136 || size>32768)
      throw new Error("vmmap_failed");
    var cursor=0;
    while (cursor+136<=size && maps.length<500) {
      var at=0x1000+cursor,rec=dv.getUint32(at,true);
      if (rec<136 || rec>1160 || cursor+rec>size)
        throw new Error("map_record_invalid");
      maps.push({start:dv.getUint32(at+8,true)+
          dv.getUint32(at+12,true)*4294967296,
        end:dv.getUint32(at+16,true)+
          dv.getUint32(at+20,true)*4294967296,
        prot:dv.getUint32(at+56,true),type:dv.getUint32(at+4,true)});
      cursor+=rec;
    }
    if (cursor!==size) throw new Error("map_not_fully_decoded");
  } finally {
    for (var x=0;x<original.length;x++) frame[0x200+x]=original[x];
  }
  var handles=[2,29,72],lines=[];
  for (var h=0;h<handles.length;h++) {
    var item=null;
    for (var z=0;z<census.modules.length;z++)
      if (census.modules[z].handle===handles[h]) item=census.modules[z];
    if (!item) {lines.push(handles[h].toString(16)+":absent");continue;}
    var found=[];
    for (var i=0;i<maps.length;i++) {
      var map=maps[i];
      if ((map.start<=item.base && item.base<map.end) ||
          Math.abs(map.start-item.base)<0x40000 ||
          Math.abs(map.end-item.base)<0x40000)
        found.push(map.start.toString(16)+"-"+map.end.toString(16)+
          "/"+map.prot+"/"+map.type);
    }
    lines.push(handles[h].toString(16)+"@"+item.base.toString(16)+
      "="+found.slice(0,6).join(","));
  }
  var restored=original.every(function(b,i){return frame[0x200+i]===b;}) &&
    state.array[0]===state.a;
  var after=n.call("getpid",[]);
  result={id:"bulk_unmatched_v1",
    status:restored && after.value===pid.value && after.high===0?
      "pass":"fail",
    details:{pid:pid.value,first:lines[0],second:lines[1],
      third:lines[2],map_entries:maps.length,restored:restored}};
} catch(error) {
  result={id:"bulk_unmatched_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
