// Bounded 14.00 comparison of null-pointer selectors with two owned pointers.
var result,phase="preflight",frame,saved,base=0x800,span=0x240;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys601!=="number"||
      typeof native.wrappers.sys585!=="number"||
      typeof native.wrappers.sys606!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function authority(){
    return native.call("sys585",[]).value+","+
      native.call("sys606",[]).value;
  }
  var before=authority(),selectors=[17,18,26,28],rows=[],stop="none";
  for(var s=0;s<selectors.length;s++){
    var selector=selectors[s];phase="selector_"+selector;
    frame.fill(0,base,base+0x200);
    frame.fill(0xa5,base+0x200,base+span);
    if(api&&typeof api.markSync==="function")
      api.markSync("mdbg_pair_before_"+selector);
    var c=native.call("sys601",[selector,native.frameAddress+base,
      native.frameAddress+base+0x100,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    var first=-1,changed=0,guard=true;
    for(var i=0;i<0x200;i++)if(frame[base+i]!==0){
      if(first<0)first=i;changed++;
    }
    for(var g=base+0x200;g<base+span;g++)
      if(frame[g]!==0xa5)guard=false;
    var current=authority();
    rows.push(selector+":"+c.value+"/"+e+"/"+changed+
      "/"+first+"/"+(guard?1:0)+"/"+current);
    if(changed||!guard||current!==before){stop=String(selector);break;}
  }
  var after=authority(),end=native.call("getpid",[]);
  result={id:"mdbg_efault_pairs_rest_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,before:before,after:after,
      rows:rows.join("|"),stop:stop}};
}catch(error){
  result={id:"mdbg_efault_pairs_rest_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
}
return [result];
