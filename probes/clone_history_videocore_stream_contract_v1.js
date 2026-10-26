// One bounded source-defined VideoCore media contract:
// exact 0x9f8 stream description, unique non-DOM URL, create/status/delete.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,m=window.__fw14BulkMapAll,
    f=n&&n.frame;
  if(!n||!m||!f||!Number.isSafeInteger(n.frameAddress)||
     !n.wrappers.videocore_create||!n.wrappers.videocore_status||
     !n.wrappers.videocore_delete||f.length<0x1400)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===61&&
    x.name==="libSceVideoCoreServerInterface.sprx";})[0];
  var rx=mod&&mod.segments.filter(function(x){
    return x.kind==="rx"&&x.size===65536;
  })[0];
  if(!rx)throw new Error("videocore_map_missing");

  var token="9763a36724a54560929cee90309faa9c";
  var url="http://192.168.1.165:8765/oracle/videocore/"+token+".mp4";
  var base=0x600,info=base+0x20,infoSize=0x9f8;
  var handleOffset=0x1040,statusOffset=0x1080,statusSize=0x200;
  var end=0x12a0,saved=Array.from(f.subarray(base,end));
  var view=new DataView(f.buffer,f.byteOffset,f.byteLength);
  var create=null,status=null,remove=null,handle=0,statusHead="";
  var guards=false,restored=false,classification="not_run";
  function putString(offset,text,capacity) {
    if(text.length+1>capacity)throw new Error("string_too_long");
    for(var i=0;i<text.length;i++)f[offset+i]=text.charCodeAt(i)&255;
    f[offset+text.length]=0;
  }
  function hex32(value) {
    return "0x"+((value>>>0).toString(16));
  }
  function hexBytes(offset,count) {
    var out="";
    for(var i=0;i<count;i++)
      out+=("0"+f[offset+i].toString(16)).slice(-2);
    return out;
  }
  function allValue(offset,count,value) {
    for(var i=0;i<count;i++)if(f[offset+i]!==value)return false;
    return true;
  }
  try {
    f.fill(0xa5,base,end);
    f.fill(0,info,info+infoSize);
    view.setUint32(handleOffset,0,true);
    f.fill(0xa5,statusOffset,statusOffset+statusSize);
    putString(info,"becore",0x20);
    putString(info+0x20,url,0x800);
    putString(info+0x820,"video/mp4",0x80);
    putString(info+0x8a0,"avc1.64001F, mp4a.40.2",0x80);
    view.setUint32(info+0x930,1,true);
    view.setUint32(info+0x948,0,true);
    view.setUint32(info+0x950,0,true);
    view.setUint32(info+0x954,0,true);
    view.setUint32(info+0x958,0,true);
    view.setUint32(info+0x95c,0,true);
    view.setUint32(info+0x960,0xffffffff,true);
    view.setUint32(info+0x968,400,true);
    view.setUint32(info+0x96c,0,true);
    f[info+0x970]=0;
    putString(info+0x971,
      "Mozilla/5.0 (PlayStation; PlayStation 4/14.00)",0x80);
    if(!allValue(base,0x20,0xa5)||
       !allValue(info+infoSize,handleOffset-(info+infoSize),0xa5)||
       f[info+0x970]!==0)
      throw new Error("stream_layout_guard_failed");

    phase="create";
    if(api&&api.markSync)api.markSync("videocore_stream_create_before");
    create=n.call("videocore_create",
      [n.frameAddress+info,0,0,n.frameAddress+handleOffset]);
    if(api&&api.markSync)api.markSync("videocore_stream_create_after");
    handle=view.getUint32(handleOffset,true);
    if((create.value>>>0)===0&&create.high===0&&handle!==0) {
      var until=Date.now()+350;
      while(Date.now()<until){}
      phase="status";
      if(api&&api.markSync)api.markSync("videocore_stream_status_before");
      status=n.call("videocore_status",
        [handle,n.frameAddress+statusOffset]);
      if(api&&api.markSync)api.markSync("videocore_stream_status_after");
      statusHead=hexBytes(statusOffset,32);
      until=Date.now()+150;
      while(Date.now()<until){}
      phase="delete";
      if(api&&api.markSync)api.markSync("videocore_stream_delete_before");
      remove=n.call("videocore_delete",[handle]);
      if(api&&api.markSync)api.markSync("videocore_stream_delete_after");
      classification=(remove.value>>>0)===0&&remove.high===0?
        "normal_stream_cleaned":"delete_failed";
    } else if((create.value>>>0)!==0) {
      classification="create_denied";
    } else {
      classification="success_without_handle";
    }
    guards=allValue(base,0x20,0xa5)&&
      allValue(info+infoSize,handleOffset-(info+infoSize),0xa5)&&
      allValue(handleOffset+4,statusOffset-(handleOffset+4),0xa5)&&
      allValue(statusOffset+statusSize,end-(statusOffset+statusSize),0xa5)&&
      f[info+0x970]===0;
  } finally {
    for(var k=0;k<saved.length;k++)f[base+k]=saved[k];
    restored=saved.every(function(x,i){return f[base+i]===x;});
  }
  var after=n.call("getpid",[]);
  restored=restored&&after.high===0&&after.value===pid.value;
  var cleanupOk=classification==="create_denied"||
    (classification==="normal_stream_cleaned");
  result={id:"videocore_stream_contract_v1",
    status:guards&&restored&&cleanupOk?"pass":"fail",
    details:{pid:pid.value,token:token,
      create_ret:create?hex32(create.value):"not_run",handle:handle,
      status_ret:status?hex32(status.value):"not_run",
      status_head:statusHead||"not_run",
      delete_ret:remove?hex32(remove.value):"not_run",
      byte_970:0,guards:guards,restored:restored,
      classification:classification,url:url}};
} catch(error) {
  result={id:"videocore_stream_contract_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
