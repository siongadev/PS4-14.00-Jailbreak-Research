// PS4 14.00 syscall 674 ABI screen. All candidate outputs are owned and guarded.
var result, phase="preflight", f, saved;
var begin=0x1800, end=0x2000;
try {
  var n=window.__fw14NativeInvoke, s=window.__fw14ArrayState;
  if(!n || !n.frame || n.frame.length<end ||
     !Number.isSafeInteger(n.frameAddress) ||
     typeof n.wrappers.sys674!=="number" ||
     !s || s.array[0]!==s.a)
    throw new Error("plan_missing");
  f=n.frame;
  saved=Array.from(f.subarray(begin,end));
  var before=n.call("getpid",[]);
  if(before.high!==0 || before.value<1 || before.value>100000)
    throw new Error("pid_invalid");
  var pid=before.value, out=n.frameAddress+begin, count=n.frameAddress+0x1d00;
  var variants=[
    [out,16,count,0,0,0],
    [out,0x400,count,0,0,0],
    [pid,out,0x400,count,0,0],
    [0,out,0x400,count,0,0],
    [pid,0,out,0x400,count,0],
    [pid,out,16,count,0,0]
  ];
  var rows=[], guard=true;
  for(var k=0;k<variants.length;k++) {
    phase="shape_"+k;
    f.fill(0xa5,begin,end);
    f[0x1d00]=0x20; f[0x1d01]=f[0x1d02]=f[0x1d03]=0;
    if(api && typeof api.markSync==="function")
      api.markSync("vquery674_before_"+k);
    var c=n.call("sys674",variants[k]);
    var errno=c.value===-1?n.readErrno():0;
    var changed=0, first="";
    for(var i=begin;i<begin+0x400;i++) {
      if(f[i]!==0xa5)changed++;
      if(i<begin+16)first+=("0"+f[i].toString(16)).slice(-2);
    }
    var num=f[0x1d00]+f[0x1d01]*256+f[0x1d02]*65536+
      f[0x1d03]*16777216;
    for(var g=0x1e00;g<end;g++)if(f[g]!==0xa5)guard=false;
    rows.push(k+":"+c.value+"/"+c.high+"e"+errno+
      "c"+changed+"n"+num+"="+first);
  }
  var after=n.call("getpid",[]);
  var pidOk=after.high===0 && after.value===pid;
  result={id:"virtual_query_all_shape_v1",
    status:guard&&pidOk&&s.array[0]===s.a?"pass":"fail",
    details:{pid:pid,rows:rows.join("|"),guard:guard,pid_ok:pidOk}};
} catch(e) {
  result={id:"virtual_query_all_shape_v1",status:"error",
    details:{phase:phase,error:String(e).slice(0,180)}};
} finally {
  if(f&&saved)for(var j=0;j<saved.length;j++)f[begin+j]=saved[j];
}
return [result];
