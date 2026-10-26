// Stage 1: map RWX, write and read back a 16-byte owned leaf, then unmap.
// This deliberately does not transfer native control to the new page.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||typeof n.runOwnedCode!=="function"||
     !s||s.array[0]!==s.a)throw new Error("runner_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var code=[0xb8,0x00,0x14,0x00,0x00,0x01,0xf8,0xc3,
    0x90,0x90,0x90,0x90,0x90,0x90,0x90,0x90];
  phase="map_write_readback";
  if(api&&api.markSync)api.markSync("owned_write_only_before");
  var run=n.runOwnedCode(code,[55],false);
  if(api&&api.markSync)api.markSync("owned_write_only_after");
  phase="postflight";
  var post=n.call("getpid",[]);
  var intact=post.value===pid.value&&post.high===0&&s.array[0]===s.a;
  result={id:"owned_code_write_only_v1",
    status:intact&&run.write_only===true?"pass":"fail",
    details:{pid:pid.value,mapped:"0x"+run.mapped_address.toString(16),
      write_only:run.write_only===true,post_pid:post.value,intact:intact}};
}catch(e){result={id:"owned_code_write_only_v1",status:"error",
  details:{phase:phase,error:String(e).slice(0,180)}};}
return [result];
