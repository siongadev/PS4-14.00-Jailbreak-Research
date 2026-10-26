// Compare requested RWX with effective protection in the 14.00 VM map.
var result,phase="preflight",n,f,saved,mappedAddress=0;
try{
  n=window.__fw14NativeInvoke;
  if(!n||typeof n.wrappers.sys477!=="number"||
     typeof n.wrappers.sys73!=="number"||
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
  phase="map_rwx";
  if(api&&api.markSync)api.markSync("rwx_vmmap_before_map");
  var m=n.call("sys477",[0,0x4000,7,0x1002,0xffffffff,0]);
  if(m.value===-1&&m.high===0xffffffff)
    throw new Error("mmap_errno_"+n.readErrno());
  mappedAddress=(m.value>>>0)+0x100000000*m.high;
  if(!Number.isSafeInteger(mappedAddress)||mappedAddress<0x100000000||
     mappedAddress>=0x100000000000||mappedAddress%0x4000!==0)
    throw new Error("mapped_address_invalid");
  phase="query_vmmap";
  if(api&&api.markSync)api.markSync("rwx_vmmap_mapped");
  f.fill(0xa5,0x200,0x9020);
  dv.setUint32(0x200,32768,true);dv.setUint32(0x204,0,true);
  dv.setUint32(0x400,1,true);dv.setUint32(0x404,14,true);
  dv.setUint32(0x408,32,true);dv.setUint32(0x40c,pid.value,true);
  var q=n.call("sysctl",[n.frameAddress+0x400,4,
    n.frameAddress+0x1000,n.frameAddress+0x200,0,0]);
  var size=dv.getUint32(0x200,true);
  if(q.value!==0||q.high!==0||size<136||size>32768)
    throw new Error("vmmap_errno_"+(q.value===-1?n.readErrno():q.value));
  var cursor=0,count=0,found=0,protection=-1,mapType=-1,span=0;
  while(cursor+136<=size&&count<500){
    var at=0x1000+cursor,rec=dv.getUint32(at,true);
    if(rec<136||rec>1160||cursor+rec>size)
      throw new Error("vmmap_record_invalid");
    var lo=dv.getUint32(at+8,true)+
      dv.getUint32(at+12,true)*4294967296;
    var hi=dv.getUint32(at+16,true)+
      dv.getUint32(at+20,true)*4294967296;
    if(lo<=mappedAddress&&mappedAddress<hi){
      found++;protection=dv.getUint32(at+56,true);
      mapType=dv.getUint32(at+4,true);span=hi-lo;
    }
    cursor+=rec;count++;
  }
  if(cursor!==size||found!==1)throw new Error("mapping_not_unique");
  phase="unmap";
  var u=n.call("sys73",[mappedAddress,0x4000]);
  if(u.value!==0||u.high!==0)throw new Error("unmap_failed");
  mappedAddress=0;
  for(var i=0;i<saved.length;i++)f[0x200+i]=saved[i];
  saved=null;
  var post=n.call("getpid",[]);
  var intact=post.value===pid.value&&post.high===0&&
    window.__fw14ArrayState.array[0]===window.__fw14ArrayState.a;
  result={id:"anon_exec_vmmap_v1",status:intact?"pass":"fail",
    details:{pid:pid.value,requested:7,effective:protection,
      type:mapType,span:span,map_entries:count,
      post_pid:post.value,intact:intact}};
}catch(e){result={id:"anon_exec_vmmap_v1",status:"error",
  details:{phase:phase,error:String(e).slice(0,180)}};}
finally{
  if(n&&mappedAddress)try{n.call("sys73",[mappedAddress,0x4000]);}catch(ignore){}
  if(f&&saved)for(var j=0;j<saved.length;j++)f[0x200+j]=saved[j];
}
return [result];
