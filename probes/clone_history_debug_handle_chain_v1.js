// 14.00 owned-object chain: 557(kind 0x4000) -> 560(handle) ->
// 601 request 1, bracketed by a matched request and request-0 readback.
var result=null,phase="preflight",n=null,f=null,nameSaved=null,workSaved=null;
var live=0,restored=false,deleteResult="not_run",pid=-1;
try {
  n=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0xa00||!n.wrappers||
     !n.wrappers.sys557||!n.wrappers.sys558||
     !n.wrappers.sys560||!n.wrappers.sys601||
     !state||state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  f=n.frame;
  var a=n.frameAddress,req=0x820,stat=0x900;
  nameSaved=Array.from(f.subarray(0x200,0x220));
  workSaved=Array.from(f.subarray(0x800,0x980));
  var p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)
    throw new Error("pid_invalid");
  pid=p.value;
  function fmt(c){return c.value+"/"+c.high+"e"+
    (c.value===-1?n.readErrno():0);}
  function status(){
    f.fill(0xa5,stat,stat+0x80);
    var c=n.call("sys601",[0,a+stat,0,0,0,0]);
    var hex="",changed=0,guard=true;
    for(var i=0;i<8;i++)hex+=("0"+f[stat+i].toString(16)).slice(-2);
    for(var j=stat;j<stat+0x40;j++)if(f[j]!==0xa5)changed++;
    for(var k=stat+0x40;k<stat+0x80;k++)
      if(f[k]!==0xa5)guard=false;
    if(c.value!==0||c.high!==0||changed!==8||!guard)
      throw new Error("request0_invalid_"+fmt(c));
    return hex;
  }
  function request(){
    var c=n.call("sys601",[1,a+req,0,0,0,0]);
    var changed=0;
    for(var i=0;i<0x80;i++)if(f[req+i]!==expected[i])changed++;
    return fmt(c)+"/changed"+changed;
  }
  f.fill(0,0x200,0x220);
  f.fill(0xa5,0x800,0x980);
  f.fill(0,req,req+0x80);
  var name="Fw14DbgChain";
  for(var i=0;i<name.length;i++){
    f[0x200+i]=name.charCodeAt(i);
    f[req+0x28+i]=name.charCodeAt(i);
  }
  var expected=Array.from(f.subarray(req,req+0x80));
  phase="create";
  var cr=n.call("sys557",[a+0x200,0,0x4000,0,0,0]);
  if(cr.value<=0||cr.value>=0x1000000||cr.high!==0)
    throw new Error("create_"+fmt(cr));
  live=cr.value;
  phase="baseline";
  var beforeStatus=status();
  if(api&&api.markSync)api.markSync("debug_chain_baseline_before");
  var beforeReq=request();
  for(var r=0;r<0x80;r++)f[req+r]=expected[r];
  phase="init";
  if(api&&api.markSync)api.markSync("debug_chain_init_before");
  var init=n.call("sys560",[live,0,0,0,0,0]);
  var initResult=fmt(init);
  phase="after";
  var afterStatus=status();
  if(api&&api.markSync)api.markSync("debug_chain_after_before");
  var afterReq=request();
  phase="delete";
  var de=n.call("sys558",[live,0x4000,0,0,0,0]);
  deleteResult=fmt(de);
  if(de.value===0&&de.high===0)live=0;
  var guards=true;
  for(var g=0x800;g<req;g++)if(f[g]!==0xa5)guards=false;
  for(var h=req+0x80;h<stat;h++)if(f[h]!==0xa5)guards=false;
  for(var t=stat+0x40;t<0x980;t++)if(f[t]!==0xa5)guards=false;
  var q=n.call("getpid",[]);
  result={id:"debug_handle_chain_v1",
    status:!live&&guards&&q.high===0&&q.value===pid?"pass":"fail",
    details:{pid:pid,handle:cr.value,
      status_before:beforeStatus,status_after:afterStatus,
      request_before:beforeReq,init:initResult,
      request_after:afterReq,delete:deleteResult,
      guards:guards,pid_ok:q.high===0&&q.value===pid}};
} catch(error) {
  result={id:"debug_handle_chain_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,170),
      pid:pid,live_handle:live,delete:deleteResult}};
} finally {
  if(live&&n&&n.wrappers&&n.wrappers.sys558){
    try {
      var last=n.call("sys558",[live,0x4000,0,0,0,0]);
      deleteResult=last.value+"/"+last.high;
      if(last.value===0)live=0;
    } catch(ignore) {}
  }
  if(f&&nameSaved&&workSaved){
    for(var x=0;x<nameSaved.length;x++)f[0x200+x]=nameSaved[x];
    for(var y=0;y<workSaved.length;y++)f[0x800+y]=workSaved[y];
    restored=true;
  }
}
if(result&&result.details){result.details.restored=restored;
  if(live)result.status="fail";}
return [result];
