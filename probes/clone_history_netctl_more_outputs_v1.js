// Two zero-input/output-only methods from the mapped 14.00 NetCtl client:
// method 0x20006 (56 bytes) and method 0x2002d (28 bytes).
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!n||!s||!m||!f||!n.wrappers.netctl_output56||
     !n.wrappers.netctl_output28||s.array[0]!==s.a||
     !Number.isSafeInteger(n.frameAddress)||f.length<0x800)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var cases=[{name:"netctl_output56",offset:0x500,size:56,mark:"netctl_20006_before"},
             {name:"netctl_output28",offset:0x600,size:28,mark:"netctl_2002d_before"}];
  var rows=[];
  for(var c=0;c<cases.length;c++){
    var item=cases[c],o=item.offset,z=item.size,guard=16;
    var saved=Array.from(f.subarray(o,o+z+guard));
    var call=null,changed=0,zeros=0,head="",guarded=false;
    try{
      f.fill(0xa5,o,o+z);
      f.fill(0x5a,o+z,o+z+guard);
      phase=item.name;
      if(api&&api.markSync)api.markSync(item.mark);
      call=n.call(item.name,[n.frameAddress+o]);
      for(var i=0;i<z;i++){
        if(f[o+i]!==0xa5)changed++;
        if(f[o+i]===0)zeros++;
      }
      for(var j=0;j<8;j++)head+=(f[o+j]<16?"0":"")+f[o+j].toString(16);
      guarded=Array.from(f.subarray(o+z,o+z+guard))
        .every(function(v){return v===0x5a;});
    }finally{for(var k=0;k<saved.length;k++)f[o+k]=saved[k];}
    var restored=saved.every(function(v,i){return f[o+i]===v;});
    rows.push({ret:call.value,high:call.high,changed:changed,zeros:zeros,
      head:head,guarded:guarded,restored:restored});
  }
  var after=n.call("getpid",[]);
  var okay=rows.every(function(x){return x.guarded&&x.restored;})&&
    after.high===0&&after.value===pid.value&&s.array[0]===s.a;
  result={id:"netctl_more_outputs_v1",status:okay?"pass":"fail",
    details:{pid:pid.value,m06_ret:rows[0].ret,
      m06_changed:rows[0].changed,m06_zeros:rows[0].zeros,m06_head:rows[0].head,
      m2d_ret:rows[1].ret,
      m2d_changed:rows[1].changed,m2d_zeros:rows[1].zeros,m2d_head:rows[1].head,
      guarded:okay,restored:okay}};
}catch(error){result={id:"netctl_more_outputs_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
