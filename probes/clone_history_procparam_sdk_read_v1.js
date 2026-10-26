// Read the current browser ProcParam SDK-version slot without mutating it.
// The root pointer comes from syscall 598 on this page; the typed-array
// carrier pointer and owned syscall-output bytes are restored afterward.
var result,phase="preflight",state=window.__fw14ArrayState;
var native=window.__fw14NativeInvoke,plan=window.__fw14NativePlan;
var frame=null,savedFrame=null,carrierSlot=-1,carrierOriginal=null;
try {
  if(!state||!native||!plan||!state.view||!state.array||
     !state.a||!state.ownedTypedView||!state.calibratedViewBase||
     !native.wrappers||
     !Number.isSafeInteger(native.frameAddress)||
     state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  frame=native.frame;
  if(!frame||frame.length<0x1e08)throw new Error("frame_short");
  var view=state.view,carrier=state.ownedTypedView;
  var base=state.calibratedViewBase;
  function valueOf(bytes){
    var value=0;
    for(var i=bytes.length-1;i>=0;i--)value=value*256+bytes[i];
    return value;
  }
  function pointerBytes(value){
    if(!Number.isSafeInteger(value)||value<0||value>=0x1000000000000)
      throw new Error("pointer_invalid");
    var out=[];
    for(var i=0;i<8;i++)out.push(Math.floor(value/Math.pow(2,i*8))&255);
    return out;
  }
  function addressOf(object){
    try{
      state.array[0]=object;
      var bytes=[];
      for(var i=0;i<8;i++)bytes.push(view[state.index+i]);
      return valueOf(bytes);
    }finally{state.array[0]=state.a;}
  }
  carrierSlot=addressOf(carrier)-base+8;
  if(!Number.isSafeInteger(carrierSlot)||carrierSlot<0||
     carrierSlot+8>=16777216)
    throw new Error("carrier_slot_invalid");
  carrierOriginal=[];
  for(var b=0;b<8;b++)carrierOriginal.push(view[carrierSlot+b]);
  function readAt(address,count){
    var next=pointerBytes(address),out=[];
    try{
      for(var i=0;i<8;i++)view[carrierSlot+i]=next[i];
      for(var j=0;j<count;j++)out.push(carrier[j]);
      return out;
    }finally{
      for(var k=0;k<8;k++)view[carrierSlot+k]=carrierOriginal[k];
    }
  }
  function hex(bytes){
    return bytes.map(function(v){return ("0"+v.toString(16)).slice(-2);}).join("");
  }
  var before=native.call("getpid",[]);
  if(before.high!==0||before.value<1||before.value>100000)
    throw new Error("pid_invalid");
  var bufOff=0x200,sizeOff=0x1e00;
  savedFrame={buffer:Array.from(frame.subarray(bufOff,bufOff+16)),
    size:Array.from(frame.subarray(sizeOff,sizeOff+8))};
  var dv=new DataView(frame.buffer);
  dv.setUint32(sizeOff,0x1000,true);
  dv.setUint32(sizeOff+4,0,true);
  phase="sys598";
  var call=native.call("sys598",[native.frameAddress+bufOff,
    native.frameAddress+sizeOff,0,0,0,0]);
  if(call.value!==0)throw new Error("sys598_"+call.value);
  var root=valueOf(Array.from(frame.subarray(bufOff,bufOff+8)));
  if(!Number.isSafeInteger(root)||root<0x10000000||
     root>=0x1000000000000||root%4096!==0)
    throw new Error("root_pointer_invalid");
  if(api&&typeof api.markSync==="function")api.markSync("sdk_root_read_before");
  phase="root_read";
  var bytes=readAt(root,32);
  if(api&&typeof api.markSync==="function")api.markSync("sdk_root_read_after");
  if(bytes[8]!==0x4f||bytes[9]!==0x52||
     bytes[10]!==0x42||bytes[11]!==0x49)
    throw new Error("orbis_magic_missing");
  var after=native.call("getpid",[]);
  result={id:"procparam_sdk_read_v1",status:"pass",
    details:{pid:before.value,root_base:"0x"+root.toString(16),
      low_word:"0x"+valueOf(bytes.slice(0x10,0x14)).toString(16),
      high_word:"0x"+valueOf(bytes.slice(0x14,0x18)).toString(16),
      root_head:hex(bytes),
      pid_ok:after.high===0&&after.value===before.value}};
  if(!result.details.pid_ok)result.status="fail";
}catch(error){
  result={id:"procparam_sdk_read_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  if(state&&state.array&&state.a)state.array[0]=state.a;
  if(frame&&savedFrame){
    for(var n=0;n<16;n++)frame[0x200+n]=savedFrame.buffer[n];
    for(var m=0;m<8;m++)frame[0x1e00+m]=savedFrame.size[m];
  }
  if(state&&state.view&&carrierOriginal&&carrierSlot>=0)
    for(var t=0;t<8;t++)state.view[carrierSlot+t]=carrierOriginal[t];
}
if(result&&result.details&&frame&&savedFrame){
  var frameRestored=true,carrierRestored=true;
  for(var n2=0;n2<16;n2++)
    if(frame[0x200+n2]!==savedFrame.buffer[n2])frameRestored=false;
  for(var m2=0;m2<8;m2++)
    if(frame[0x1e00+m2]!==savedFrame.size[m2])frameRestored=false;
  for(var t2=0;t2<8;t2++)
    if(state.view[carrierSlot+t2]!==carrierOriginal[t2])carrierRestored=false;
  result.details.frame_restored=frameRestored;
  result.details.carrier_restored=carrierRestored;
  if(result.status==="pass"&&(!frameRestored||!carrierRestored))
    result.status="fail";
}
return [result];
