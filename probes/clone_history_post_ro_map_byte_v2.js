// Test the first byte of the page-local RW map after the read-only group.
var result,phase="preflight";
try {
  var state=window.__fw14ArrayState,n=window.__fw14NativeInvoke;
  var held=window.__fw14FullVMMap;
  if (!state || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
      !n || !held || !held.maps || !api || !api.markSync)
    throw new Error("faulted_map_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value!==held.pid || state.array[0]!==state.a)
    throw new Error("page_identity_changed");
  var carrier=state.ownedTypedView,forged=state.view;
  if (carrier.length!==65536 || carrier[0]!==0x31 || carrier[7]!==0xa8)
    throw new Error("carrier_canary_changed");
  function bytesAt(index,count) {
    var out=[];for(var i=0;i<count;i++)out.push(forged[index+i]);return out;
  }
  function valueOf(bytes) {
    var value=0;for(var i=bytes.length-1;i>=0;i--)value=value*256+bytes[i];
    return value;
  }
  function pointerBytes(value) {
    var out=[];for(var i=0;i<8;i++)out.push(Math.floor(value/Math.pow(2,8*i))&255);
    return out;
  }
  function same(a,b) {
    if(a.length!==b.length)return false;
    for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;
    return true;
  }
  var hits=[];
  for(var m=1;m<held.maps.length;m++){
    var map=held.maps[m],prior=held.maps[m-1];
    if(map.prot===3&&map.type===1&&
       prior.prot===1&&prior.type===2&&prior.end-prior.start===114688)
      hits.push({index:m+1,start:map.start,size:map.end-map.start});
  }
  if(hits.length!==1)throw new Error("post_ro_map_signature_not_unique_"+hits.length);
  var word;
  try {state.array[0]=carrier;word=valueOf(bytesAt(state.index,8));}
  finally {state.array[0]=state.a;}
  var slot=word-state.calibratedViewBase+8;
  if(!Number.isSafeInteger(slot)||slot<0||slot+8>=16777216)
    throw new Error("carrier_slot_outside_view");
  var original=bytesAt(slot,8),ptr=pointerBytes(hits[0].start);
  api.markSync("post_ro_map_first_byte_before");
  phase="read_byte";
  var value;
  try {
    for(var i=0;i<8;i++)forged[slot+i]=ptr[i];
    value=carrier[0];
  } finally {
    for(var j=0;j<8;j++)forged[slot+j]=original[j];
  }
  var restored=same(bytesAt(slot,8),original)&&state.array[0]===state.a&&
    carrier[0]===0x31&&carrier[7]===0xa8;
  api.markSync("post_ro_map_first_byte_done");
  result={id:"post_ro_map_byte_v2",status:restored?"pass":"fail",
    details:{pid:pid.value,map_index:hits[0].index,map_start:hits[0].start,
      map_size:hits[0].size,first_byte:value,restored:restored}};
}catch(error){result={id:"post_ro_map_byte_v2",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
