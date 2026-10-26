// Spread sample above the previously mapped low selector range.
var result, phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||!native.wrappers.sys601)
    throw new Error("caller_missing");
  function mark(s){try{if(api&&typeof api.markSync==="function")
    api.markSync(s);}catch(_){}}
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var values=[32,33,40,64,96,128,255], rows=[];
  mark("mh_start");
  for(var i=0;i<values.length;i++){
    var v=values[i];phase="selector_"+v;
    mark("mh_before_"+v);
    var c=native.call("sys601",[v,0,0,0,0,0]);
    var e=c.value===-1?native.readErrno():null;
    rows.push(v+":"+c.value+"/"+c.high.toString(16)+"/"+
      (e===null?"ok":e));
  }
  var end=native.call("getpid",[]);
  result={id:"mdbg_high_sample_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|")}};
}catch(error){result={id:"mdbg_high_sample_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
return [result];
