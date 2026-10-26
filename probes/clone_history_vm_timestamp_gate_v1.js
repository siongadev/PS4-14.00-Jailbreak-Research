// Test whether observed changing number-624 returns behave like a VM-map
// timestamp, as the historical syscall table suggests, not an object ID.
var result,phase="preflight";
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys624!=="number")
    throw new Error("caller_missing");
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1)throw new Error("pid_invalid");
  var rows=[];
  function sample(label,arg){
    var call=native.call("sys624",[arg,0,0,0,0,0]);
    var err=call.value===-1?native.readErrno():0;
    rows.push(label+":"+call.value+"/"+call.high+"/"+err);
  }
  phase="before_allocation";
  sample("b0",0);sample("b1",0);sample("b2",4);
  sample("b3",0xffffffff);sample("b4",0);
  phase="owned_allocation";
  var buffer=new ArrayBuffer(1048576),bytes=new Uint8Array(buffer);
  for(var p=0;p<bytes.length;p+=16384)bytes[p]=(p/16384+1)&255;
  sample("a0",0);sample("a1",0);sample("a2",4);
  sample("a3",0xffffffff);sample("a4",0);
  if(bytes[0]!==1||bytes[16384]!==2)throw new Error("allocation_changed");
  var end=native.call("getpid",[]);
  result={id:"vm_timestamp_gate_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join(";"),allocation_bytes:bytes.length}};
}catch(error){result={id:"vm_timestamp_gate_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
return [result];
