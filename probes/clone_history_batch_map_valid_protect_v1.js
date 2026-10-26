// Test the published 32-byte batch-map record layout on an owned mapping.
// Operation 2 re-applies read-only protection; the mapping is unmapped.
var result, phase="preflight", native, frame, saved, mappedAddress=0;
var base=0x1800, span=0x280;
try {
  native=window.__fw14NativeInvoke;
  if (!native || typeof native.call!=="function" ||
      typeof native.wrappers.sys548!=="number" ||
      typeof native.wrappers.sys477!=="number" ||
      typeof native.wrappers.sys73!=="number" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if (base+span>=frame.length) throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  function failed(v) { return v.value===-1 && v.high===0xffffffff; }
  function address(v) {
    var a=(v.value>>>0)+0x100000000*v.high;
    if (!Number.isSafeInteger(a) || a<0x100000000 ||
        a>=0x100000000000 || a%0x4000!==0)
      throw new Error("mapped_address_invalid");
    return a;
  }
  function put64(off,v) {
    if (!Number.isSafeInteger(v) || v<0) throw new Error("word_invalid");
    for (var i=0;i<8;i++) frame[off+i]=Math.floor(v/Math.pow(2,8*i))&255;
  }
  var pid=native.call("getpid",[]);
  if (pid.high!==0 || pid.value<1 || pid.value>100000)
    throw new Error("pid_invalid");
  phase="map";
  var mapped=native.call("sys477",[0,0x4000,1,0x1002,0xffffffff,0]);
  if (failed(mapped)) throw new Error("map_errno_"+native.readErrno());
  mappedAddress=address(mapped);
  frame.fill(0,base,base+0x100);
  frame.fill(0xa5,base+0x200,base+0x240);
  frame.fill(0x5a,base+0x240,base+0x280);
  put64(base,mappedAddress);  // start
  put64(base+8,0);           // offset
  put64(base+16,0x4000);    // length
  frame[base+24]=1;         // read-only protection
  frame[base+25]=0;         // memory type
  frame[base+28]=2;         // protect operation
  phase="batch_call";
  if (api && typeof api.markSync==="function") api.markSync("batch548_valid_before");
  var c=native.call("sys548",[native.frameAddress+base,1,
    native.frameAddress+base+0x200,0,0,0]);
  var err=failed(c)?native.readErrno():0;
  if (api && typeof api.markSync==="function") api.markSync("batch548_valid_after");
  var processed=Array.from(frame.subarray(base+0x200,base+0x208));
  var changed=0, guard=true;
  for (var j=0;j<32;j++) {
    var expected=j<8?Math.floor(mappedAddress/Math.pow(2,8*j))&255:
      j>=16&&j<24?Math.floor(0x4000/Math.pow(2,8*(j-16)))&255:
      j===24?1:j===28?2:0;
    if (frame[base+j]!==expected) changed++;
  }
  for (var g=base+0x240;g<base+0x280;g++)
    if (frame[g]!==0x5a) guard=false;
  phase="unmap";
  var unmapped=native.call("sys73",[mappedAddress,0x4000]);
  var unmapErr=failed(unmapped)?native.readErrno():0;
  if (unmapped.value!==0 || unmapped.high!==0)
    throw new Error("unmap_errno_"+unmapErr);
  mappedAddress=0;
  var end=native.call("getpid",[]);
  result={id:"batch_map_valid_protect_v1",
    status:end.value===pid.value&&end.high===0&&guard?"pass":"fail",
    details:{pid:pid.value,ret:c.value,high:c.high,errno:err,
      processed:processed,record_changed:changed,guard:guard,
      mapped:"0x"+address(mapped).toString(16),unmap:unmapped.value}};
} catch(error) {
  result={id:"batch_map_valid_protect_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
} finally {
  if (native && mappedAddress)
    try { native.call("sys73",[mappedAddress,0x4000]); } catch(ignore) {}
  if (frame && saved)
    for (var r=0;r<saved.length;r++) frame[base+r]=saved[r];
}
return [result];
