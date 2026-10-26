// Compare successful two-pointer requests against the request-0 readback.
var result,phase="preflight",frame,saved,off=0x800,endOff=0x1240;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys601!=="number"||
      typeof native.wrappers.sys585!=="number"||
      typeof native.wrappers.sys606!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(endOff>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(off,endOff));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function authority(){
    return native.call("sys585",[]).value+","+
      native.call("sys606",[]).value;
  }
  function status(){
    frame.fill(0xa5,off,off+0x80);
    var c=native.call("sys601",[0,native.frameAddress+off,0,0,0,0]);
    var changed=0,guard=true,hex="";
    for(var i=0;i<0x40;i++)if(frame[off+i]!==0xa5)changed++;
    for(var g=off+0x40;g<off+0x80;g++)
      if(frame[g]!==0xa5)guard=false;
    for(var h=0;h<8;h++)
      hex+=("0"+frame[off+h].toString(16)).slice(-2);
    if(c.value!==0||c.high!==0||changed!==8||!guard)
      throw new Error("status_read_failed");
    return hex;
  }
  var initial=status(),before=authority(),selectors=[14,26],rows=[],stop="none";
  for(var s=0;s<selectors.length;s++){
    var selector=selectors[s];phase="selector_"+selector;
    frame.fill(0,0x1000,0x1200);
    frame.fill(0xa5,0x1200,endOff);
    if(api&&typeof api.markSync==="function")
      api.markSync("mdbg_stat_before_"+selector);
    var c=native.call("sys601",[selector,native.frameAddress+0x1000,
      native.frameAddress+0x1100,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    var changed=0,guard=true;
    for(var i=0x1000;i<0x1200;i++)if(frame[i]!==0)changed++;
    for(var j=0x1200;j<endOff;j++)if(frame[j]!==0xa5)guard=false;
    var readback=status(),auth=authority();
    rows.push(selector+":"+c.value+"/"+e+"/"+changed+
      "/"+(guard?1:0)+"/"+readback+"/"+auth);
    if(c.value!==0||changed||!guard||readback!==initial||auth!==before){
      stop=String(selector);break;
    }
  }
  var end=native.call("getpid",[]);
  result={id:"mdbg_pair_status_14_26_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,initial:initial,before:before,
      rows:rows.join("|"),stop:stop}};
}catch(error){
  result={id:"mdbg_pair_status_14_26_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[off+r]=saved[r];
}
return [result];
