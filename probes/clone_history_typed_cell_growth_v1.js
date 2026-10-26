// Append a rooted typed-array batch and measure its live cell addresses.
// No pointer write or native call. Repeat only while the page stays live.
var result,phase="preflight",state=window.__fw14ArrayState;
try{
  if(!state||!state.array||!state.a||!state.view||
     !state.calibratedViewBase||state.array[0]!==state.a)
    throw new Error("history_state_missing");
  var view=state.view,base=state.calibratedViewBase;
  function wordOf(value){
    var bytes=[];
    try{
      state.array[0]=value;
      for(var j=0;j<8;j++)bytes.push(view[state.index+j]);
    }finally{state.array[0]=state.a;}
    var out=0;
    for(var k=7;k>=0;k--)out=out*256+bytes[k];
    return out;
  }
  if(!Number.isSafeInteger(base)||base%4096!==0)
    throw new Error("base_invalid");
  phase="allocate";
  var pool=[];
  for(var i=0;i<8192;i++){
    var a=new Uint8Array(1);
    a[0]=i&255;
    pool.push(a);
  }
  if(!state.typedGrowthBatches)state.typedGrowthBatches=[];
  state.typedGrowthBatches.push(pool);
  var first=wordOf(pool[0])-base;
  var middle=wordOf(pool[4095])-base;
  var last=wordOf(pool[8191])-base;
  result={id:"typed_cell_growth_v1",status:"pass",details:{
    batch:state.typedGrowthBatches.length,
    rooted:state.typedGrowthBatches.length*8192,
    first_index:first,middle_index:middle,last_index:last,
    forward_seen:first>=0||middle>=0||last>=0,
    array_restored:state.array[0]===state.a}};
}catch(error){
  if(state&&state.array&&state.a)state.array[0]=state.a;
  result={id:"typed_cell_growth_v1",status:"error",details:{
    phase:phase,error:String(error).slice(0,180)}};
}
return [result];
