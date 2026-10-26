// 14.00 libSceSystemService RX+0x28110 opens /dev/sbl_srv with flags 2.
// Source-matched open gate only: no ioctl, read, write, or mmap.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,f=n&&n.frame;
  if(!n||!s||s.array[0]!==s.a||!f||f.length<0x1100||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers.open||!n.wrappers.close)
    throw new Error("native_plan_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  var po=0x1000,path="/dev/sbl_srv",saved=Array.from(f.subarray(po,po+64));
  var opened=null,closed=null,openErr=0,closeErr=0;
  try {
    f.fill(0,po,po+64);
    for(var i=0;i<path.length;i++)f[po+i]=path.charCodeAt(i);
    phase="open";
    if(api&&api.markSync)api.markSync("sbl_srv_open_before");
    opened=n.call("open",[n.frameAddress+po,2,0]);
    if(opened.value===-1)openErr=n.readErrno();
    if(opened.high===0&&opened.value>=3&&opened.value<1024){
      phase="close";
      closed=n.call("close",[opened.value]);
      if(closed.value===-1)closeErr=n.readErrno();
    }
  }finally{
    for(var j=0;j<saved.length;j++)f[po+j]=saved[j];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[po+i]===v;});
  var denied=opened&&opened.value===-1&&opened.high===0xffffffff&&openErr>0;
  var allowed=opened&&opened.high===0&&opened.value>=3&&opened.value<1024&&
    closed&&closed.value===0;
  result={id:"sbl_srv_open_v1",status:(denied||allowed)&&restored?"pass":"fail",
    details:{pid:before.value,open:opened?opened.value:null,
      open_high:opened?opened.high:null,open_errno:openErr,
      close:closed?closed.value:null,close_errno:closeErr,restored:restored}};
}catch(error){result={id:"sbl_srv_open_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
