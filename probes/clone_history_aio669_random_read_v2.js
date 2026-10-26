// One source-shaped AIO read of /dev/random, with owned request/results.
// Keep frame/descriptor alive if completion or deletion cannot be confirmed.
var result,phase="preflight",n=null,f=null,saved=null,fd=-1,safeToRelease=true;
try{
  n=window.__fw14NativeInvoke;
  var s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.frame||n.frame.length<0x1b00||
     !Number.isSafeInteger(n.frameAddress)||!s||s.array[0]!==s.a||
     [669,664,662].some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
    throw new Error("plan_missing");
  f=n.frame;var a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  saved=Array.from(f.subarray(0x1800,0x1b00));
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength),guard=true;
  function put64(off,v){
    if(!Number.isSafeInteger(v)||v<0)throw new Error("address_invalid");
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  function fmt(c){return c.value+"/"+c.high+"e"+
    (c.value===-1?n.readErrno():0);}
  f.fill(0,0x1800,0x1b00);
  f.fill(0xa5,0x1900,0x19c0);
  f.fill(0xa5,0x1a80,0x1b00);
  var path="/dev/random";
  for(var i=0;i<path.length;i++)f[0x1a00+i]=path.charCodeAt(i);
  phase="open";
  var opened=n.call("open",[a+0x1a00,0,0]);
  if(opened.high!==0||opened.value<0||opened.value>1024)
    throw new Error("open_failed_"+fmt(opened));
  fd=opened.value;
  put64(0x1800,0);       // file offset
  put64(0x1808,1);       // byte count
  put64(0x1810,a+0x1900); // read buffer
  put64(0x1818,a+0x1920); // SceKernelAioResult
  dv.setInt32(0x1820,fd,true);
  phase="submit";
  if(api&&api.markSync)api.markSync("aio_random_submit_before");
  var sub=n.call("sys669",[1,a+0x1800,1,3,a+0x1940,0]);
  var subText=fmt(sub),id=dv.getInt32(0x1940,true);
  var pollText="not_run",deleteText="not_run",pollState=0;
  var resultState=dv.getUint32(0x1928,true),polls=0;
  if(sub.value===0){
    safeToRelease=false;
    if(id<=0||id>0x10000000)throw new Error("id_invalid_"+id);
    phase="poll";
    if(api&&api.markSync)api.markSync("aio_random_poll_before");
    for(var t=0;t<8;t++){
      var pol=n.call("sys664",[a+0x1940,1,a+0x1960,0,0,0]);
      pollText=fmt(pol);polls++;
      pollState=dv.getUint32(0x1960,true);
      resultState=dv.getUint32(0x1928,true);
      if(pollState===3||pollState===4||resultState===3||resultState===4)
        break;
    }
    if(pollState===3||pollState===4||resultState===3||resultState===4){
      phase="delete";
      if(api&&api.markSync)api.markSync("aio_random_delete_before");
      var del=n.call("sys662",[a+0x1940,1,a+0x1980,0,0,0]);
      deleteText=fmt(del);
      if(del.value===0) safeToRelease=true;
    }
  }
  var dataByte=f[0x1900],resultLow=dv.getInt32(0x1920,true);
  for(var g=0x1a80;g<0x1b00;g++)if(f[g]!==0xa5)guard=false;
  if(safeToRelease){
    phase="close";
    var closed=n.call("close",[fd]);
    if(closed.value!==0)throw new Error("close_failed_"+fmt(closed));
    fd=-1;
  }
  var q=n.call("getpid",[]);
  result={id:"aio669_random_read_v2",
    status:guard&&q.high===0&&q.value===p.value&&safeToRelease?"pass":"fail",
    details:{pid:p.value,submit:subText,id:id,poll:pollText,
      polls:polls,poll_state:pollState,result_state:resultState,
      result_low:resultLow,data_byte:dataByte,deleted:deleteText,
      guard:guard,cleaned:safeToRelease}};
}catch(error){result={id:"aio669_random_read_v2",status:"error",
  details:{phase:phase,error:String(error).slice(0,180),
    fd:fd,cleaned:safeToRelease}};}
finally{
  if(f&&saved&&safeToRelease)
    for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
  if(n&&fd>=0&&safeToRelease)
    try{n.call("close",[fd]);}catch(ignore){}
}
return [result];
