// Read-only /dev/dipsw getters copied from four VideoOut client call sites.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,f=n&&n.frame;
  if(!n||!s||s.array[0]!==s.a||!f||f.length<0x1800||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers.ioctl)
    throw new Error("native_plan_missing");
  var first=n.call("getpid",[]);
  if(first.high!==0||first.value<1)throw new Error("pid_control_failed");
  var po=0x1000,oo=0x1100,path="/dev/dipsw";
  var saved=Array.from(f.subarray(po,po+64));
  var savedOut=Array.from(f.subarray(oo,oo+24));
  var opened=null,closed=null,openErr=0,closeErr=0,rows=[];
  var requests=[0x40048806,0x40048807,0x40088808,0x40088809];
  var sizes=[4,4,8,8];
  try {
    f.fill(0,po,po+64);
    for(var i=0;i<path.length;i++)f[po+i]=path.charCodeAt(i);
    phase="open";
    opened=n.call("open",[n.frameAddress+po,0,0]);
    if(opened.value===-1)openErr=n.readErrno();
    if(opened.value>=3&&opened.value<1024&&opened.high===0){
      try {
        for(var j=0;j<requests.length;j++){
          phase="getter_"+j;
          f.fill(0xa5,oo,oo+24);
          if(api&&api.markSync)api.markSync("dipsw_get_before_"+j);
          var called=n.call("ioctl",[opened.value,requests[j],n.frameAddress+oo]);
          var errno=called.value===-1?n.readErrno():0;
          if(api&&api.markSync)api.markSync("dipsw_get_after_"+j);
          var bytes=Array.from(f.subarray(oo,oo+sizes[j]));
          var guard=Array.from(f.subarray(oo+sizes[j],oo+24))
            .every(function(v){return v===0xa5;});
          rows.push({request:requests[j],return_value:called.value,
            return_high:called.high,errno:errno,bytes:bytes,
            output_changed:bytes.some(function(v){return v!==0xa5;}),
            guard:guard});
        }
      }finally{
        phase="close";
        closed=n.call("close",[opened.value]);
        if(closed.value===-1)closeErr=n.readErrno();
      }
    }
  }finally{
    for(var k=0;k<saved.length;k++)f[po+k]=saved[k];
    for(var q=0;q<savedOut.length;q++)f[oo+q]=savedOut[q];
  }
  var last=n.call("getpid",[]);
  var restored=last.high===0&&last.value===first.value&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[po+i]===v;})&&
    savedOut.every(function(v,i){return f[oo+i]===v;});
  result={id:"dipsw_getters_v1",status:opened&&closed&&closed.value===0&&
    rows.length===4&&rows.every(function(r){return r.guard;})&&restored?
    "pass":"fail",details:{pid:first.value,open:opened?opened.value:null,
    open_errno:openErr,rows_json:JSON.stringify(rows),close:closed?closed.value:null,
    close_errno:closeErr,restored:restored}};
}catch(error){result={id:"dipsw_getters_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
