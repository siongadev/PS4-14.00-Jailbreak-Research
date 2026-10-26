// 14.00 RegMgr 0x19 keyed read and source-derived 0x1a data-write gate.
// Reuses the observed value so no setting change is requested.
var result,phase="preflight",f,saved;
var begin=0x1000,end=0x1200;
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<end||
     !Number.isSafeInteger(n.frameAddress)||
     typeof n.wrappers.sys532!=="number"||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  f=n.frame;saved=Array.from(f.subarray(begin,end));
  var pid0=n.call("getpid",[]);
  if(pid0.high!==0||pid0.value<1||pid0.value>100000)
    throw new Error("pid_invalid");
  f.fill(0xa5,begin,end);
  var key=[0x7b,0x61,0xf5,0xec,0x28,0x63,0x35,0x12];
  function setupRead(off){
    for(var i=0;i<8;i++)f[off+i]=key[i];
    for(var j=8;j<16;j++)f[off+j]=0;
  }
  function u32(off){return(f[off]+f[off+1]*256+f[off+2]*65536+
    f[off+3]*16777216)>>>0;}
  function put32(off,v){for(var j=0;j<4;j++)f[off+j]=(v>>>j*8)&255;}
  setupRead(0x1000);put32(0x1100,0xffffffff);
  phase="read_before";
  if(api&&api.markSync)api.markSync("regmgr_idem_read_before");
  var a=n.call("sys532",[0x19,0,n.frameAddress+0x1100,
    n.frameAddress+0x1000,16,0]);
  var aErr=a.value===-1?n.readErrno():0;
  var aStatus=u32(0x1100),aValue=u32(0x100c);
  var b=null,bErr=null,bStatus=null,c=null,cErr=null,cStatus=null,cValue=null;
  if(a.value===0&&aStatus===0){
    for(var k=0;k<8;k++)f[0x1040+k]=key[k];
    for(var h=8;h<12;h++)f[0x1040+h]=0;
    put32(0x104c,0);
    put32(0x1050,4);put32(0x1054,0);
    put32(0x1058,aValue);
    put32(0x1110,0xffffffff);
    phase="write_same_value";
    if(api&&api.markSync)api.markSync("regmgr_idem_write_before");
    b=n.call("sys532",[0x1a,0,n.frameAddress+0x1110,
      n.frameAddress+0x1040,0x1c,0]);
    bErr=b.value===-1?n.readErrno():0;bStatus=u32(0x1110);
    setupRead(0x1080);put32(0x1120,0xffffffff);
    phase="read_after";
    if(api&&api.markSync)api.markSync("regmgr_idem_read_after_before");
    c=n.call("sys532",[0x19,0,n.frameAddress+0x1120,
      n.frameAddress+0x1080,16,0]);
    cErr=c.value===-1?n.readErrno():0;
    cStatus=u32(0x1120);cValue=u32(0x108c);
  }
  var guard=true;
  for(var x=0x1130;x<end;x++)if(f[x]!==0xa5)guard=false;
  var pid1=n.call("getpid",[]),pidOk=pid1.high===0&&pid1.value===pid0.value;
  result={id:"regmgr_language_idempotent_write_v2",
    status:guard&&pidOk&&s.array[0]===s.a?"pass":"fail",
    details:{pid:pid0.value,
      read:a.value+"/e"+aErr+"/s"+aStatus.toString(16),
      write:b?b.value+"/e"+bErr+"/s"+bStatus.toString(16):"skipped",
      verify:c?c.value+"/e"+cErr+"/s"+cStatus.toString(16):"skipped",
      value_before:aValue,value_after:cValue,guard:guard,pid_ok:pidOk}};
}catch(e){result={id:"regmgr_language_idempotent_write_v2",status:"error",
  details:{phase:phase,error:String(e).slice(0,180)}};
}finally{if(f&&saved)for(var z=0;z<saved.length;z++)f[begin+z]=saved[z];}
return [result];
