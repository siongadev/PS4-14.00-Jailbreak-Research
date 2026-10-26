// A 16-byte x86-64 leaf: mov eax,0x1400; add eax,edi; ret; NOP padding.
// Execute only from a newly owned and read-back-verified 14.00 RWX page.
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
  phase="execute_owned_code";
  if(api&&api.markSync)api.markSync("owned_code_before");
  var call=n.runOwnedCode(code,[55]);
  if(api&&api.markSync)api.markSync("owned_code_after");
  phase="postflight";
  var post=n.call("getpid",[]);
  var intact=post.value===pid.value&&post.high===0&&s.array[0]===s.a;
  var correct=call.value===0x1437&&call.high===0;
  result={id:"owned_native_code_v1",
    status:intact&&correct?"pass":"fail",
    details:{pid:pid.value,computed:call.value,expected:0x1437,
      high:call.high,mapped:"0x"+call.mapped_address.toString(16),
      post_pid:post.value,intact:intact,correct:correct}};
}catch(e){result={id:"owned_native_code_v1",status:"error",
  details:{phase:phase,error:String(e).slice(0,180)}};}
return [result];
