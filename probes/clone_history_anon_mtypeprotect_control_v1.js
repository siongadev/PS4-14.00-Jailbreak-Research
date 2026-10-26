// Check whether the same mtypeprotect 379 shape accepts a RW->RW no-op.
var result,n,f,saved,held=0,phase="preflight";
try {
  n=window.__fw14NativeInvoke;
  if(!n||typeof n.wrappers.sys477!=="number"||
     typeof n.wrappers.sys73!=="number"||
     typeof n.wrappers.sys379!=="number"||
     typeof n.wrappers.sysctl!=="number"||
     !n.frame||!Number.isSafeInteger(n.frameAddress))
    throw new Error("caller_missing");
  f=n.frame;
  if(f.length<0x9020)throw new Error("frame_short");
  saved=Array.from(f.subarray(0x200,0x9020));
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var rows=[];
  for(var k=0;k<1;k++) {
    var desired=3;
    phase="map_"+desired;
    if(api&&api.markSync)api.markSync("mtype_before_"+desired);
    var m=n.call("sys477",[0,0x4000,3,0x1002,0xffffffff,0]);
    if(m.value===-1&&m.high===0xffffffff)
      throw new Error("mmap_errno_"+n.readErrno());
    held=(m.value>>>0)+0x100000000*m.high;
    if(!Number.isSafeInteger(held)||held<0x100000000||
       held>=0x100000000000||held%0x4000!==0)
      throw new Error("mapped_address_invalid");
    phase="protect_"+desired;
    var p=n.call("sys379",[held,0x4000,desired,0]);
    var code=p.value===-1?n.readErrno():0;
    phase="query_"+desired;
    f.fill(0xa5,0x200,0x9020);
    dv.setUint32(0x200,32768,true);dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,32,true);dv.setUint32(0x40c,pid.value,true);
    var q=n.call("sysctl",[n.frameAddress+0x400,4,
      n.frameAddress+0x1000,n.frameAddress+0x200,0,0]);
    var size=dv.getUint32(0x200,true);
    if(q.value!==0||q.high!==0||size<136||size>32768)
      throw new Error("vmmap_errno_"+(q.value===-1?n.readErrno():q.value));
    var cursor=0,count=0,found=0,effective=-1,span=0;
    while(cursor+136<=size&&count<500) {
      var at=0x1000+cursor,rec=dv.getUint32(at,true);
      if(rec<136||rec>1160||cursor+rec>size)
        throw new Error("vmmap_record_invalid");
      var lo=dv.getUint32(at+8,true)+
        dv.getUint32(at+12,true)*4294967296;
      var hi=dv.getUint32(at+16,true)+
        dv.getUint32(at+20,true)*4294967296;
      if(lo<=held&&held<hi) {
        found++;effective=dv.getUint32(at+56,true);span=hi-lo;
      }
      cursor+=rec;count++;
    }
    if(cursor!==size||found!==1||span!==0x4000)
      throw new Error("mapping_not_unique");
    rows.push("3>"+desired+":"+p.value+"/e"+code+">"+effective);
    phase="unmap_"+desired;
    var u=n.call("sys73",[held,0x4000]);
    if(u.value!==0||u.high!==0)throw new Error("unmap_failed");
    held=0;
  }
  for(var i=0;i<saved.length;i++)f[0x200+i]=saved[i];
  saved=null;
  var post=n.call("getpid",[]);
  var intact=post.value===pid.value&&post.high===0&&
    window.__fw14ArrayState.array[0]===window.__fw14ArrayState.a;
  result={id:"anon_mtypeprotect_control_v1",status:intact?"pass":"fail",
    details:{pid:pid.value,rows:rows.join(","),post_pid:post.value,
      intact:intact}};
} catch(e) {
  result={id:"anon_mtypeprotect_control_v1",status:"error",
    details:{phase:phase,error:String(e).slice(0,180)}};
} finally {
  if(n&&held)try{n.call("sys73",[held,0x4000]);}catch(ignore){}
  if(f&&saved)for(var j=0;j<saved.length;j++)f[0x200+j]=saved[j];
}
return [result];
