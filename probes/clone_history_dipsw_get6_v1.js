// Sony's captured VideoOut client opens /dev/dipsw read-only and issues
// ioctl 0x40048806 with a four-byte output. Run that exact read path on
// owned memory, preserving the output guard and closing the descriptor.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  var f=n&&n.frame;
  if(!n||!s||s.array[0]!==s.a||!f||f.length<0x1800||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers.ioctl)
    throw new Error("native_plan_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  var po=0x1000,oo=0x1100,path="/dev/dipsw";
  var saved=Array.from(f.subarray(po,po+64));
  var savedOut=Array.from(f.subarray(oo,oo+16));
  var opened=null,called=null,closed=null,openErr=0,callErr=0,closeErr=0;
  var out=null,guard=false;
  try {
    f.fill(0,po,po+64);
    for(var i=0;i<path.length;i++)f[po+i]=path.charCodeAt(i);
    f.fill(0xa5,oo,oo+16);
    phase="open";
    opened=n.call("open",[n.frameAddress+po,0,0]);
    if(opened.value===-1)openErr=n.readErrno();
    if(opened.value>=3&&opened.value<1024&&opened.high===0){
      try {
        phase="ioctl";
        if(api&&api.markSync)api.markSync("dipsw_get6_before");
        called=n.call("ioctl",[opened.value,0x40048806,n.frameAddress+oo]);
        if(called.value===-1)callErr=n.readErrno();
        if(api&&api.markSync)api.markSync("dipsw_get6_after");
        out=(f[oo]+f[oo+1]*256+f[oo+2]*65536+f[oo+3]*16777216)>>>0;
        guard=Array.from(f.subarray(oo+4,oo+16)).every(function(v){return v===0xa5;});
      }finally{
        phase="close";
        closed=n.call("close",[opened.value]);
        if(closed.value===-1)closeErr=n.readErrno();
      }
    }
  }finally{
    for(var j=0;j<saved.length;j++)f[po+j]=saved[j];
    for(var k=0;k<savedOut.length;k++)f[oo+k]=savedOut[k];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&
    s.array[0]===s.a&&
    saved.every(function(v,i){return f[po+i]===v;})&&
    savedOut.every(function(v,i){return f[oo+i]===v;});
  result={id:"dipsw_get6_v1",status:opened&&called&&closed&&guard&&restored&&
    closed.value===0?"pass":"fail",details:{pid:before.value,
    open:opened?opened.value:null,open_errno:openErr,
    ioctl:called?called.value:null,ioctl_high:called?called.high:null,
    ioctl_errno:callErr,output:out,output_changed:out!==0xa5a5a5a5,
    guard:guard,close:closed?closed.value:null,close_errno:closeErr,
    restored:restored}};
}catch(error){result={id:"dipsw_get6_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
