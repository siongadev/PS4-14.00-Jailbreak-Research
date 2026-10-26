// Compare self and live-parent VM-map size queries, then bounded parent read.
var result,phase="preflight";
try{
  var native=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if(!native||!native.frame||!Number.isSafeInteger(native.frameAddress)||
      typeof native.wrappers.sysctl!=="number"||
      typeof native.wrappers.getppid!=="number"||
      !state||state.array[0]!==state.a)
    throw new Error("caller_missing");
  var frame=native.frame,address=native.frameAddress;
  if(frame.length<0x9020||address<0x200000000||address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]),parent=native.call("getppid",[]);
  if(self.high!==0||self.value<1||self.value>100000||
      parent.high!==0||parent.value<1||parent.value>100000||
      self.value===parent.value)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x200,0x9020));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  function query(pid,read){
    frame.fill(0xa5,0x200,0x9020);
    dv.setUint32(0x200,read?32768:0,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,32,true);
    dv.setUint32(0x40c,pid,true);
    var c=native.call("sysctl",[address+0x400,4,
      read?address+0x1000:0,address+0x200,0,0]);
    var e=c.value===-1?native.readErrno():null;
    var length=dv.getUint32(0x200,true);
    var guard=frame[0x208]===0xa5&&frame[0x20f]===0xa5&&
      frame[0x9000]===0xa5&&frame[0x901f]===0xa5&&
      dv.getUint32(0x400,true)===1&&
      dv.getUint32(0x404,true)===14&&
      dv.getUint32(0x408,true)===32&&
      dv.getUint32(0x40c,true)===pid;
    if(!guard)throw new Error("query_guard_changed");
    return {ret:c.value,errno:e===null?"ok":e,length:length};
  }
  var own,parentSize,parentRead=null,first="";
  try{
    phase="own_size";own=query(self.value,false);
    if(own.ret!==0||own.length<136)
      throw new Error("own_size_control_failed");
    if(api&&typeof api.markSync==="function")
      api.markSync("parent_vmmap_before");
    phase="parent_size";parentSize=query(parent.value,false);
    if(parentSize.ret===0&&parentSize.length>=136&&
        parentSize.length<=32768){
      phase="parent_read";parentRead=query(parent.value,true);
      if(parentRead.ret===0&&parentRead.length>=136){
        var recordSize=dv.getUint32(0x1000,true);
        if(recordSize>=136&&recordSize<=1160&&
            recordSize<=parentRead.length){
          var start=dv.getUint32(0x1008,true)+
            dv.getUint32(0x100c,true)*4294967296;
          var end=dv.getUint32(0x1010,true)+
            dv.getUint32(0x1014,true)*4294967296;
          if(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&
              end>start)
            first="0x"+start.toString(16)+"-0x"+end.toString(16);
        }
      }
    }
    if(api&&typeof api.markSync==="function")
      api.markSync("parent_vmmap_after");
  }finally{
    for(var i=0;i<original.length;i++)frame[0x200+i]=original[i];
  }
  var restored=original.every(function(byte,index){
    return frame[0x200+index]===byte;})&&state.array[0]===state.a;
  result={id:"parent_vmmap_gate_v1",status:restored?"pass":"fail",
    details:{self_pid:self.value,parent_pid:parent.value,
      own_ret:own.ret,own_size:own.length,
      parent_ret:parentSize.ret,parent_errno:parentSize.errno,
      parent_size:parentSize.length,
      read_ret:parentRead?parentRead.ret:"skipped",
      read_errno:parentRead?parentRead.errno:"skipped",
      read_size:parentRead?parentRead.length:0,
      first_range:first||"none",restored:restored}};
}catch(error){
  result={id:"parent_vmmap_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
