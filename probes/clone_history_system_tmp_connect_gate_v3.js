// Connect/close only; no application-protocol payload is sent.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,frame=n&&n.frame;
  if (!n || !frame || !Number.isSafeInteger(n.frameAddress) ||
      !n.wrappers || typeof n.wrappers.sys97!=="number" ||
      typeof n.wrappers.sys98!=="number" ||
      typeof n.wrappers.close!=="number" || frame.length<0x900)
    throw new Error("native_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1) throw new Error("pid_invalid");
  var slot=0x500,width=106,original=Array.from(frame.subarray(slot,slot+width));
  var cases=[
    ["control","/system_tmp/Fw14NoSuchSocket"],
    ["video_arbitrator","/system_tmp/gpvdec_arbitrator"],
    ["video_encoder","/system_tmp/gpvenc_proxy"]
  ];
  var rows=[],allClosed=true;
  try {
    for (var c=0;c<cases.length;c++) {
      var label=cases[c][0],path=cases[c][1];
      phase=label;
      frame.fill(0,slot,slot+width);
      frame[slot+1]=1;
      for (var i=0;i<path.length;i++) frame[slot+2+i]=path.charCodeAt(i);
      var opened=n.call("sys97",[1,1,0]); // AF_UNIX, SOCK_STREAM
      var openErr=opened.value===-1?n.readErrno():0;
      var connectValue=null,connectErr=0,closeValue=null,closeErr=0;
      if (opened.value>=0 && opened.value<1024 && opened.high===0) {
        try {
          if (api && api.markSync) api.markSync("sock_before_"+label);
          var connected=n.call("sys98",[opened.value,n.frameAddress+slot,width]);
          connectValue=connected.value;
          connectErr=connected.value===-1?n.readErrno():0;
        } finally {
          var closed=n.call("close",[opened.value]);
          closeValue=closed.value;
          closeErr=closed.value===-1?n.readErrno():0;
          if (closeValue!==0) allClosed=false;
        }
      } else allClosed=false;
      rows.push(label+":"+opened.value+"/"+openErr+"/"+
        connectValue+"/"+connectErr+"/"+closeValue+"/"+closeErr);
    }
  } finally {
    for (var k=0;k<width;k++) frame[slot+k]=original[k];
  }
  var end=n.call("getpid",[]);
  var restored=end.high===0 && end.value===pid.value &&
    original.every(function(v,i){return frame[slot+i]===v;});
  result={id:"system_tmp_connect_gate_v3",
    status:restored && allClosed && rows.length===cases.length?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|"),restored:restored,
      all_closed:allClosed}};
} catch(error) {
  result={id:"system_tmp_connect_gate_v3",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
