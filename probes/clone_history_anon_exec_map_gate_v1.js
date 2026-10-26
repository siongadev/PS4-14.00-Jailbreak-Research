// Compare 14.00 anonymous RW, RX and RWX mmap permissions on owned pages.
var result,phase="preflight",n,maps=[];
try{
  n=window.__fw14NativeInvoke;
  if(!n||typeof n.wrappers.sys477!=="number"||
     typeof n.wrappers.sys73!=="number")throw new Error("caller_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function one(label,prot){
    phase="map_"+label;
    if(api&&api.markSync)api.markSync("execmap_before_"+label);
    var c=n.call("sys477",[0,0x4000,prot,0x1002,0xffffffff,0]);
    var bad=c.value===-1&&c.high===0xffffffff;
    var e=bad?n.readErrno():0;
    var addr=bad?0:(c.value>>>0)+0x100000000*c.high;
    if(!bad){
      if(!Number.isSafeInteger(addr)||addr<0x100000000||
         addr>=0x100000000000||addr%0x4000!==0)
        throw new Error("address_invalid_"+label);
      maps.push(addr);
    }
    return bad?"-1/e"+e:"0x"+addr.toString(16);
  }
  var rw=one("rw",3),rx=one("rx",5),rwx=one("rwx",7);
  phase="cleanup";
  var cleanup=true;
  for(var i=maps.length-1;i>=0;i--){
    var u=n.call("sys73",[maps[i],0x4000]);
    if(u.value!==0||u.high!==0)cleanup=false;
  }
  maps=[];
  var post=n.call("getpid",[]);
  var intact=post.value===pid.value&&post.high===0&&
    window.__fw14ArrayState.array[0]===window.__fw14ArrayState.a;
  result={id:"anon_exec_map_gate_v1",
    status:cleanup&&intact?"pass":"fail",
    details:{pid:pid.value,rw:rw,rx:rx,rwx:rwx,
      unmapped:cleanup,intact:intact}};
}catch(e){result={id:"anon_exec_map_gate_v1",status:"error",
  details:{phase:phase,error:String(e).slice(0,180)}};}
finally{if(n)for(var j=maps.length-1;j>=0;j--)
  try{n.call("sys73",[maps[j],0x4000]);}catch(ignore){}}
return [result];
