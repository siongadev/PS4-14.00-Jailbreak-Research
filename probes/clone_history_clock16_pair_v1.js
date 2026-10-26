// Four read-only clock calls in one native continuation: 0, 16, 0, 16.
var result,phase="preflight",frame,saved;
var base=0x1800,span=0x100;
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if(!native || typeof native.call!=="function" ||
      typeof native.callMany!=="function" ||
      typeof native.wrappers.sys232!=="number" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("clock_caller_missing");
  frame=native.frame;
  if(base+span>frame.length)throw new Error("owned_frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  frame.fill(0x5a,base,base+span);
  var offsets=[0,0x20,0x40,0x60];
  var ids=[0,16,0,16];
  var calls=[];
  for(var i=0;i<4;i++){
    frame.fill(0xa5,base+offsets[i],base+offsets[i]+16);
    calls.push({name:"sys232",args:[ids[i],native.frameAddress+base+offsets[i],0,0,0,0]});
  }
  var pid=native.call("getpid",[]);
  if(pid.high!==0 || pid.value<1)throw new Error("pid_control_invalid");
  phase="paired_clocks";
  if(api && typeof api.markSync==="function")api.markSync("clock_pair_before");
  var paired=native.callMany(calls);
  if(api && typeof api.markSync==="function")api.markSync("clock_pair_after");
  if(!paired || !paired.values || paired.values.length!==4)
    throw new Error("four_clock_returns_missing");
  function read32(at){
    return frame[at]+frame[at+1]*256+frame[at+2]*65536+frame[at+3]*16777216;
  }
  var samples=[];
  for(var j=0;j<4;j++){
    var at=base+offsets[j];
    var sec=read32(at),nano=read32(at+8);
    var value=paired.values[j];
    samples.push({sec:sec,nano:nano,ret:value.value,high:value.high});
  }
  var end=native.call("getpid",[]);
  var guard=Array.from(frame.subarray(base+0x70,base+span)).every(function(v){return v===0x5a;});
  var valid=samples.every(function(v){
    return v.ret===0 && v.high===0 && v.sec>1500000000 &&
      v.sec<2500000000 && v.nano<1000000000;
  });
  function stamp(v){return v.ret+"/"+v.sec+"/"+v.nano;}
  result={id:"clock16_pair_v1",
    status:guard && valid && end.high===0 && end.value===pid.value &&
      state.array[0]===state.a?"pass":"fail",
    details:{pid:pid.value,clock0_a:stamp(samples[0]),
      clock16_a:stamp(samples[1]),clock0_b:stamp(samples[2]),
      clock16_b:stamp(samples[3]),
      delta_a_ms:Math.round(1000*(samples[1].sec-samples[0].sec)+
        (samples[1].nano-samples[0].nano)/1000000),
      delta_b_ms:Math.round(1000*(samples[3].sec-samples[2].sec)+
        (samples[3].nano-samples[2].nano)/1000000),
      guard:guard,carrier_restored:state.array[0]===state.a}};
} catch(error) {
  result={id:"clock16_pair_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
} finally {
  if(frame && saved) {
    for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
    result.details.frame_restored=saved.every(function(v,i){return frame[base+i]===v;});
  }
}
return [result];
