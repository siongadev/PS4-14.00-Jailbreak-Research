// Test two previously unmeasured 601 selectors with an owned zero buffer.
// Stop after selector 2 if it succeeds, writes output, or changes a measured
// authority indicator; restore all owned bytes after the comparison.
var result,phase="preflight",frame=null,saved=null;
try {
  var native=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if(!native||!native.wrappers||!native.wrappers.sys601||
     !native.wrappers.sys585||!native.wrappers.sys606||
     !native.wrappers.sys600||!native.frame||
     !Number.isSafeInteger(native.frameAddress)||!state||
     state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  frame=native.frame;
  var off=0x800,buf=off+0x20,size=0x80;
  if(frame.length<0x920)throw new Error("frame_too_small");
  saved=Array.from(frame.subarray(off,off+0x120));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function indicator(name){
    var r=native.call(name,[0,0,0,0,0,0]);
    return r.value+(r.value===-1?"/"+native.readErrno():"");
  }
  function stateValues(){
    return [indicator("sys585"),indicator("sys606"),
      indicator("sys600")].join(",");
  }
  function clearBuffer(){frame.fill(0,buf,buf+size);}
  function changed(){
    var n=0;
    for(var i=0;i<size;i++)if(frame[buf+i]!==0)n++;
    return n;
  }
  function request(selector){
    clearBuffer();
    if(api&&typeof api.markSync==="function")
      api.markSync("mdbg"+selector+"_before");
    var r=native.call("sys601",[selector,native.frameAddress+buf,0,0,0,0]);
    var errno=r.value===-1?native.readErrno():0;
    if(api&&typeof api.markSync==="function")
      api.markSync("mdbg"+selector+"_after");
    return {code:r.value,errno:errno,changed:changed()};
  }
  frame.fill(0xa5,off,off+0x120);
  clearBuffer();
  var before=stateValues();
  phase="selector2";
  var two=request(2);
  var afterTwo=stateValues();
  var three=null,after=afterTwo;
  if(two.code===-1&&two.changed===0&&afterTwo===before){
    phase="selector3";
    three=request(3);
    after=stateValues();
  }
  var guards=frame[off]===0xa5&&frame[off+0x1f]===0xa5&&
    frame[off+0xa0]===0xa5&&frame[off+0x11f]===0xa5;
  var end=native.call("getpid",[]);
  var pidOk=end.high===0&&end.value===pid.value&&state.array[0]===state.a;
  result={id:"mdbg_selector23_v1",status:guards&&pidOk?"pass":"fail",
    details:{pid:pid.value,before:before,
      selector2:two.code+"/"+two.errno,changed2:two.changed,
      selector3:three?three.code+"/"+three.errno:"skipped",
      changed3:three?three.changed:-1,after:after,
      guards:guards,pid_ok:pidOk}};
}catch(error){
  result={id:"mdbg_selector23_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  if(frame&&saved)
    for(var j=0;j<saved.length;j++)frame[0x800+j]=saved[j];
}
if(result&&result.details&&frame&&saved){
  var restored=true;
  for(var k=0;k<saved.length;k++)
    if(frame[0x800+k]!==saved[k])restored=false;
  result.details.restored=restored;
  if(!restored&&result.status==="pass")result.status="fail";
}
return [result];
