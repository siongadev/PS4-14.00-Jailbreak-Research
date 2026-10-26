// Match measured module pointers to RX mappings, including base pointers
// that point inside the module's contiguous RW mapping.
var checks, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, state=window.__fw14ArrayState;
  var census=window.__fw14BulkModules;
  if (!n || !n.wrappers.sysctl || !n.frame ||
      !Number.isSafeInteger(n.frameAddress) || !state ||
      state.array[0]!==state.a || !census || !census.modules)
    throw new Error("native_or_module_census_missing");
  var frame=n.frame, address=n.frameAddress;
  if (frame.length<0x9020) throw new Error("frame_short");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value!==census.pid)
    throw new Error("page_identity_changed");
  var original=Array.from(frame.subarray(0x200,0x9020));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var maps=[],mapped=[],missing=[],fallback=[];
  try {
    phase="vmmap";
    if (api && api.markSync) api.markSync("bulk_map_before");
    frame.fill(0xa5,0x200,0x9020);
    dv.setUint32(0x200,32768,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,32,true);
    dv.setUint32(0x40c,pid.value,true);
    var ret=n.call("sysctl",[address+0x400,4,
      address+0x1000,address+0x200,0,0]);
    var size=dv.getUint32(0x200,true);
    if (ret.value!==0 || size<136 || size>32768)
      throw new Error("vmmap_failed_"+(ret.value===-1?n.readErrno():ret.value));
    var cursor=0;
    while (cursor+136<=size && maps.length<500) {
      var at=0x1000+cursor, rec=dv.getUint32(at,true);
      if (rec<136 || rec>1160 || cursor+rec>size)
        throw new Error("vmmap_record_invalid");
      var start=dv.getUint32(at+8,true)+
        dv.getUint32(at+12,true)*4294967296;
      var end=dv.getUint32(at+16,true)+
        dv.getUint32(at+20,true)*4294967296;
      maps.push({start:start,end:end,prot:dv.getUint32(at+56,true),
        type:dv.getUint32(at+4,true)});
      cursor+=rec;
    }
    if (cursor!==size) throw new Error("vmmap_not_fully_decoded");
    maps.sort(function(a,b){return a.start-b.start;});
    for (var m=0;m<census.modules.length;m++) {
      var item=census.modules[m], index=-1;
      for (var k=0;k<maps.length;k++) if (maps[k].start<=item.base &&
          item.base<maps[k].end && maps[k].prot===5 && maps[k].type===9) {
        index=k; break;
      }
      if (index<0) for (var f=2;f<maps.length;f++) {
        if (maps[f].start<=item.base && item.base<maps[f].end &&
            maps[f].prot===3 && maps[f-1].prot===1 &&
            maps[f-2].prot===5 && maps[f-2].type===9 &&
            maps[f-2].end===maps[f-1].start &&
            maps[f-1].end===maps[f].start) {
          index=f-2; fallback.push(item.handle.toString(16)); break;
        }
      }
      if (index<0 || maps[index].prot!==5 || maps[index].type!==9) {
        missing.push(item.handle.toString(16)); continue;
      }
      var segments=[];
      var kinds=["rx","ro","rw"];
      var expected=[5,1,3];
      for (var s=0;s<3;s++) {
        var map=maps[index+s];
        if (!map || map.prot!==expected[s] ||
            map.end<=map.start || map.end-map.start>0x10000000 ||
            (s>0 && map.start!==maps[index+s-1].end)) break;
        segments.push({kind:kinds[s],start:map.start,
          size:map.end-map.start,prot:map.prot,type:map.type});
      }
      mapped.push({handle:item.handle,name:item.name,base:item.base,
        segments:segments});
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[0x200+x]=original[x];
  }
  var restored=original.every(function(b,i){return frame[0x200+i]===b;}) &&
    state.array[0]===state.a;
  var pidAfter=n.call("getpid",[]);
  if (!restored || pidAfter.value!==pid.value || pidAfter.high!==0)
    throw new Error("vmmap_not_restored");
  window.__fw14BulkMapAll={pid:pid.value,modules:mapped};
  window.__fw14BulkMissingMap={pid:pid.value,
    modules:mapped.filter(function(item){
      return item.handle===2 || item.handle===29 || item.handle===72;
    })};
  if (api && api.markSync) api.markSync("bulk_map_done");
  checks=[];
  for (var g=0;g<8;g++) {
    var rows=mapped.slice(g*4,(g+1)*4).map(function(item){
      return item.handle.toString(16)+":"+item.segments.map(function(seg){
        return seg.kind+"@"+seg.start.toString(16)+"+"+
          seg.size.toString(16);
      }).join(",");
    }).join("|");
    var details={rows:rows};
    if (g===0) {
      details.pid=pid.value; details.modules=mapped.length;
      details.missing=missing.join(",").slice(0,160);
      details.fallback=fallback.join(",");
      details.map_entries=maps.length;
    }
    checks.push({id:"bulk_map_"+g+"_v3",
      status:missing.length===0?"pass":"fail",details:details});
  }
} catch(error) {
  checks=[];
  for (var h=0;h<8;h++) checks.push({id:"bulk_map_"+h+"_v3",
    status:"error",details:{phase:phase,error:String(error).slice(0,180)}});
}
return checks;
