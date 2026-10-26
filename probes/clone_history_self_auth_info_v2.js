// Source-shaped syscall 607 read of this process's live SELF path.
// The path is queried on this page; no process address or path is reused.
var result, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.wrappers.sys607||!n.wrappers.sysctl||
     !n.frame||n.frame.length<0x2000||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a) throw new Error("plan_missing");
  var f=n.frame, a=n.frameAddress;
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1||before.value>100000)
    throw new Error("pid_invalid");
  var saved=Array.from(f.subarray(0x200,0xb20));
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  var path="", pathRet=null, pathErrno=0, pathLen=0;
  var valid=null, validErrno=0, validHex="", validChanged=0;
  var missing=null, missingErrno=0, missingHex="", missingChanged=0;
  var guard=false, pathGuard=false;
  function hexAt(off,count){
    var t="";
    for(var i=0;i<count;i++) t+=("0"+f[off+i].toString(16)).slice(-2);
    return t;
  }
  function changed(off,count){
    var c=0;
    for(var i=0;i<count;i++) if(f[off+i]!==0xa5)c++;
    return c;
  }
  try {
    f.fill(0xa5,0x200,0xb20);
    dv.setUint32(0x200,512,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,12,true);
    dv.setUint32(0x40c,before.value,true);
    phase="self_path";
    if(api&&api.markSync)api.markSync("auth_self_path_before");
    pathRet=n.call("sysctl",[a+0x400,4,a+0x600,a+0x200,0,0]);
    pathErrno=pathRet.value===-1?n.readErrno():0;
    pathLen=dv.getUint32(0x200,true);
    if(pathRet.value!==0||pathRet.high!==0||pathLen<2||pathLen>512)
      throw new Error("self_path_unavailable_"+pathErrno);
    var end=0;
    while(end<pathLen&&f[0x600+end]!==0)end++;
    if(end<2||end>=pathLen||end>460)
      throw new Error("self_path_shape");
    for(var p=0;p<end;p++)path+=String.fromCharCode(f[0x600+p]);
    if(path.charAt(0)!=="/"||path.indexOf("NKWebProcess.self")<0)
      throw new Error("unexpected_self_path");
    pathGuard=f[0x800]===0xa5&&f[0x81f]===0xa5&&
      dv.getUint32(0x400,true)===1&&dv.getUint32(0x40c,true)===before.value;
    if(!pathGuard)throw new Error("path_guard_changed");
    var bad=path+".fw14-no-such-self";
    if(bad.length>=128)throw new Error("control_path_too_long");
    for(var b=0;b<bad.length;b++)f[0x800+b]=bad.charCodeAt(b);
    f[0x800+bad.length]=0;
    phase="valid_auth";
    f.fill(0xa5,0x900,0xa20);
    if(api&&api.markSync)api.markSync("auth_valid_before");
    valid=n.call("sys607",[a+0x600,a+0x900]);
    if(api&&api.markSync)api.markSync("auth_valid_after");
    validErrno=valid.value===-1?n.readErrno():0;
    validHex=hexAt(0x900,96);
    validChanged=changed(0x900,256);
    var validGuard=changed(0xa00,32)===0;
    phase="missing_auth";
    f.fill(0xa5,0x900,0xa20);
    if(api&&api.markSync)api.markSync("auth_missing_before");
    missing=n.call("sys607",[a+0x800,a+0x900]);
    if(api&&api.markSync)api.markSync("auth_missing_after");
    missingErrno=missing.value===-1?n.readErrno():0;
    missingHex=hexAt(0x900,32);
    missingChanged=changed(0x900,256);
    guard=validGuard&&changed(0xa00,32)===0&&
      f[0x600]===47&&f[0x800]===47;
  } finally {
    for(var x=0;x<saved.length;x++)f[0x200+x]=saved[x];
  }
  var after=n.call("getpid",[]);
  var restored=saved.every(function(v,i){return f[0x200+i]===v;})&&
    s.array[0]===s.a&&after.high===0&&after.value===before.value;
  result={id:"self_auth_info_v2",status:restored&&guard&&pathGuard?
    "pass":"fail",details:{pid:before.value,self_path:path,
      valid_ret:valid.value,valid_errno:validErrno,
      valid_changed:validChanged,valid_hex:validHex,
      missing_ret:missing.value,missing_errno:missingErrno,
      missing_changed:missingChanged,
      guard:guard,restored:restored}};
} catch(error) {
  result={id:"self_auth_info_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
