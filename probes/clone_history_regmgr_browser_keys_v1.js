// Two exact keyed reads from 14.00 libSceNKWebKitRequirements callsites.
// Key 0x6b336df7b046cf43 chooses root-certificate loading behavior.
// Key 0x4fbe69bd2982e2ac feeds a separate boolean browser check.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,f=n&&n.frame;
  if(!n||!s||s.array[0]!==s.a||!f||f.length<0x1400||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers.sys532)
    throw new Error("native_plan_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  var io=0x1000,so=0x1100;
  var savedIn=Array.from(f.subarray(io,io+32));
  var savedStatus=Array.from(f.subarray(so,so+16));
  var keys=[{name:"root_certificates",bytes:[0x43,0xcf,0x46,0xb0,0xf7,0x6d,0x33,0x6b]},
            {name:"browser_boolean",bytes:[0xac,0xe2,0x82,0x29,0xbd,0x69,0xbe,0x4f]}];
  var rows=[],guards=true;
  try {
    for(var q=0;q<keys.length;q++){
      var key=keys[q],ret,err=0;
      f.fill(0xa5,io,io+32);f.fill(0xa5,so,so+16);
      for(var i=0;i<8;i++)f[io+i]=key.bytes[i];
      for(var j=8;j<16;j++)f[io+j]=0;
      phase="call_"+key.name;
      if(api&&api.markSync)api.markSync("regmgr_"+key.name+"_before");
      ret=n.call("sys532",[0x19,0,n.frameAddress+so,n.frameAddress+io,16]);
      if(ret.value===-1)err=n.readErrno();
      if(api&&api.markSync)api.markSync("regmgr_"+key.name+"_after");
      var record=Array.from(f.subarray(io,io+16));
      var status=Array.from(f.subarray(so,so+4));
      var guard=Array.from(f.subarray(io+16,io+32)).every(function(v){return v===0xa5;})&&
        Array.from(f.subarray(so+4,so+16)).every(function(v){return v===0xa5;});
      guards=guards&&guard;
      rows.push({name:key.name,return_value:ret.value,return_high:ret.high,
        errno:err,record_hex:record.map(function(v){return(v+256).toString(16).slice(1);}).join(""),
        status_hex:status.map(function(v){return(v+256).toString(16).slice(1);}).join(""),guard:guard});
    }
  }finally{
    for(var a=0;a<savedIn.length;a++)f[io+a]=savedIn[a];
    for(var b=0;b<savedStatus.length;b++)f[so+b]=savedStatus[b];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&s.array[0]===s.a&&
    savedIn.every(function(v,i){return f[io+i]===v;})&&
    savedStatus.every(function(v,i){return f[so+i]===v;});
  result={id:"regmgr_browser_keys_v1",status:rows.length===2&&guards&&restored?"pass":"fail",
    details:{pid:before.value,rows_json:JSON.stringify(rows),guards:guards,restored:restored}};
}catch(error){result={id:"regmgr_browser_keys_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
