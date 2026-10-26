// Locate two distinct objects retained from the same History clone.
// Calibrate only when both live marker positions predict one view base.
var result,phase="preflight",state=window.__fw14ArrayState;
var aa=null,bb=null,armed=false;
try {
  if(!state||!state.view||!state.array||!state.a||
     state.array[0]!==state.a||!Number.isInteger(state.index)||
     !state.cloneAnchorA||!state.cloneAnchorB||
     state.cloneAnchorA===state.cloneAnchorB)
    throw new Error("clone_anchor_state_missing");
  aa=state.cloneAnchorA;bb=state.cloneAnchorB;
  if(aa.marker!==0x51515151||bb.marker!==0x53535353)
    throw new Error("clone_marker_changed");
  var view=state.view,start=state.cloneScanCursor||0;
  var end=Math.min(start+1048576,view.length-4);
  if(start>=8388608)throw new Error("scan_limit_reached");
  aa.marker=0x5a112233;bb.marker=0x5a445566;armed=true;
  if(api&&typeof api.markSync==="function")api.markSync("clone_scan_before");
  phase="scan";
  var hitsA=0,hitsB=0,liveA=0,liveB=0;
  var pairs=state.cloneScanPairs||[];
  for(var i=start;i<end;i++){
    if(view[i+3]!==0x5a)continue;
    var target=null,label="";
    if(view[i]===0x33&&view[i+1]===0x22&&view[i+2]===0x11){
      target=aa;label="a";hitsA++;
    }else if(view[i]===0x66&&view[i+1]===0x55&&view[i+2]===0x44){
      target=bb;label="b";hitsB++;
    }
    if(!target)continue;
    var original=target.marker,live=false;
    try{
      target.marker=0x55667788;
      live=view[i]===0x88&&view[i+1]===0x77&&
        view[i+2]===0x66&&view[i+3]===0x55;
    }finally{target.marker=original;}
    if(!live)continue;
    if(label==="a")liveA++;else liveB++;
    var word="0x";
    try{
      state.array[0]=target;
      for(var w=7;w>=0;w--)
        word+=view[state.index+w].toString(16).padStart(2,"0");
    }finally{state.array[0]=state.a;}
    var address=Number(word),base=address+8-i;
    if(Number.isSafeInteger(address)&&Number.isSafeInteger(base)&&base>0){
      var prior=pairs.findIndex(function(p){return p.label===label;});
      var pair={label:label,index:i,base:base,word:word};
      if(prior>=0)pairs[prior]=pair;else pairs.push(pair);
    }
  }
  if(api&&typeof api.markSync==="function")api.markSync("clone_scan_after");
  aa.marker=0x51515151;bb.marker=0x53535353;armed=false;
  state.array[0]=state.a;
  state.cloneScanPairs=pairs;
  state.cloneScanCursor=end;
  var pa=pairs.find(function(p){return p.label==="a";});
  var pb=pairs.find(function(p){return p.label==="b";});
  var calibrated=false;
  if(pa&&pb&&pa.base===pb.base){
    aa.marker=0x11223344;
    if(view[pa.index]===0x44&&view[pa.index+1]===0x33&&
       view[pa.index+2]===0x22&&view[pa.index+3]===0x11){
      state.addressAnchor=aa;
      state.calibratedViewBase=pa.base;
      calibrated=true;
    }else aa.marker=0x51515151;
  }
  result={id:"cloned_anchor_scan_v1",status:"pass",
    details:{scan_from:start,scan_to:end,hits_a:hitsA,hits_b:hitsB,
      live_a:liveA,live_b:liveB,
      pair_a:pa?pa.index.toString(16)+"/"+pa.word+"/"+pa.base.toString(16):"",
      pair_b:pb?pb.index.toString(16)+"/"+pb.word+"/"+pb.base.toString(16):"",
      calibrated:calibrated,
      base:calibrated?"0x"+pa.base.toString(16):"",
      array_restored:state.array[0]===state.a}};
}catch(error){
  result={id:"cloned_anchor_scan_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}finally{
  if(armed){if(aa)aa.marker=0x51515151;if(bb)bb.marker=0x53535353;}
  if(state&&state.array&&state.a)state.array[0]=state.a;
}
return [result];
