// Remaining mapped 14.00 tail wrappers, one marked zero-argument call each.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  var nums=[669,670,673,675,676];
  if(!n||!n.wrappers||!n.frame||!s||s.array[0]!==s.a||
     nums.some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
    throw new Error("plan_missing");
  var p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  var rows=[];
  for(var i=0;i<nums.length;i++){
    phase="sys"+nums[i];
    if(api&&api.markSync)api.markSync("tail_zero_before_"+nums[i]);
    var c=n.call("sys"+nums[i],[0,0,0,0,0,0]);
    rows.push(nums[i]+":"+c.value+"/"+c.high+"e"+
      (c.value===-1?n.readErrno():0));
  }
  var q=n.call("getpid",[]);
  var restored=q.high===0&&q.value===p.value&&s.array[0]===s.a;
  result={id:"tail_zero_sweep_v1",status:restored?"pass":"fail",
    details:{pid:p.value,rows:rows.join("|"),restored:restored}};
}catch(error){result={id:"tail_zero_sweep_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
