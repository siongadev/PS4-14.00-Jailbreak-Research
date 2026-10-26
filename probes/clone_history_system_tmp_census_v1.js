// Read the browser-visible /system_tmp directory with owned memory.
var result, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, frame=n&&n.frame;
  if (!n || !frame || !Number.isSafeInteger(n.frameAddress) ||
      !n.wrappers || typeof n.wrappers.sys196!=="number" ||
      typeof n.wrappers.open!=="number" ||
      typeof n.wrappers.close!=="number" || frame.length<0x3800)
    throw new Error("native_plan_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value<1) throw new Error("pid_invalid");
  var pathOffset=0x1000,outOffset=0x2000,baseOffset=0x3000;
  var path="/system_tmp", savedPath=Array.from(frame.subarray(pathOffset,pathOffset+64));
  var savedOut=Array.from(frame.subarray(outOffset,outOffset+4096));
  var savedBase=Array.from(frame.subarray(baseOffset,baseOffset+8));
  var opened=null,read=null,closed=null,openErr=0,readErr=0,closeErr=0;
  var raw="",names=[],count=0;
  try {
    frame.fill(0,pathOffset,pathOffset+64);
    for (var i=0;i<path.length;i++) frame[pathOffset+i]=path.charCodeAt(i);
    frame.fill(0xa5,outOffset,outOffset+4096);
    frame.fill(0,baseOffset,baseOffset+8);
    phase="open";
    opened=n.call("open",[n.frameAddress+pathOffset,0,0]);
    openErr=opened.value===-1?n.readErrno():0;
    if (opened.value>=0 && opened.value<1024 && opened.high===0) {
      try {
        phase="read";
        if (api && api.markSync) api.markSync("system_tmp_before_read");
        read=n.call("sys196",[opened.value,n.frameAddress+outOffset,
          4096,n.frameAddress+baseOffset]);
        readErr=read.value===-1?n.readErrno():0;
        if (api && api.markSync) api.markSync("system_tmp_after_read");
        if (read.value>0 && read.value<=4096 && read.high===0) {
          count=read.value;
          var rawCount=Math.min(count,240);
          for (var j=0;j<rawCount;j++)
            raw+=(frame[outOffset+j]+256).toString(16).slice(1);
          var at=0;
          while (at+8<=count && names.length<80) {
            var size=frame[outOffset+at+4]+
              256*frame[outOffset+at+5];
            var nameLen=frame[outOffset+at+7];
            if (size<8 || at+size>count || nameLen>size-8) break;
            var name="";
            for (var k=0;k<nameLen;k++)
              name+=String.fromCharCode(frame[outOffset+at+8+k]);
            names.push(name);
            at+=size;
          }
        }
      } finally {
        phase="close";
        closed=n.call("close",[opened.value]);
        closeErr=closed.value===-1?n.readErrno():0;
      }
    }
  } finally {
    for (var a=0;a<savedPath.length;a++) frame[pathOffset+a]=savedPath[a];
    for (var b=0;b<savedOut.length;b++) frame[outOffset+b]=savedOut[b];
    for (var c=0;c<savedBase.length;c++) frame[baseOffset+c]=savedBase[c];
  }
  var end=n.call("getpid",[]);
  var restored=end.high===0 && end.value===pid.value &&
    savedPath.every(function(v,i){return frame[pathOffset+i]===v;}) &&
    savedOut.every(function(v,i){return frame[outOffset+i]===v;}) &&
    savedBase.every(function(v,i){return frame[baseOffset+i]===v;});
  result={id:"system_tmp_census_v1",
    status:restored && opened && opened.value>=0 && read &&
      read.value>=0 && closed && closed.value===0?"pass":"fail",
    details:{pid:pid.value,open:opened?opened.value:null,open_errno:openErr,
      read:read?read.value:null,read_errno:readErr,
      close:closed?closed.value:null,close_errno:closeErr,
      raw_prefix:raw,names:names.join("|").slice(0,500),restored:restored}};
} catch(error) {
  result={id:"system_tmp_census_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
