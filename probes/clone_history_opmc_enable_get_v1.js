// Compare OPMC readback before and after one enable call; disable on exit.
var result,phase="preflight",n=null,f=null,saved=null,enabled=false;
try{
  n=window.__fw14NativeInvoke;
  var s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.frame||n.frame.length<0x1840||
     !Number.isSafeInteger(n.frameAddress)||!s||s.array[0]!==s.a||
     [563,564,567].some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
    throw new Error("plan_missing");
  f=n.frame; saved=Array.from(f.subarray(0x1800,0x1840));
  var a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000) throw new Error("pid_invalid");
  var rows=[],guard=true;
  function fmt(c){return c.value+"/"+c.high+"e"+(c.value===-1?n.readErrno():0);}
  function read(label,args){
    f.fill(0xa5,0x1800,0x1840);
    if(api&&api.markSync)api.markSync("opmc_"+label);
    var c=n.call("sys567",args), ret=fmt(c), changed=0;
    for(var i=0;i<16;i++)if(f[0x1800+i]!==0xa5)changed++;
    for(var g=0x1810;g<0x1840;g++)if(f[g]!==0xa5)guard=false;
    rows.push(label+":"+ret+"c"+changed);
  }
  try{
    phase="before";read("before",[a+0x1800,0,0,0,0,0]);
    phase="enable";
    if(api&&api.markSync)api.markSync("opmc_enable_before");
    var en=n.call("sys563",[0,0,0,0,0,0]);
    rows.push("enable:"+fmt(en));enabled=en.value===0;
    phase="after";
    read("after0",[a+0x1800,0,0,0,0,0]);
    read("after1",[a+0x1800,1,0,0,0,0]);
  }finally{
    phase="disable";
    if(enabled){
      if(api&&api.markSync)api.markSync("opmc_disable_before");
      var dis=n.call("sys564",[0,0,0,0,0,0]);
      rows.push("disable:"+fmt(dis));
    }
    for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];
  }
  var q=n.call("getpid",[]);
  var restored=q.high===0&&q.value===p.value&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[0x1800+i]===v;});
  result={id:"opmc_enable_get_v1",status:guard&&restored?"pass":"fail",
    details:{pid:p.value,rows:rows.join("|"),guard:guard,restored:restored}};
}catch(error){
  result={id:"opmc_enable_get_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
