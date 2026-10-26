// Emit the second half of the VM-map snapshot retained by the census probe.
var checks, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, state=window.__fw14ArrayState;
  var held=window.__fw14FullVMMap;
  if (!n || !state || state.array[0]!==state.a || !held ||
      !held.maps || held.maps.length<73 || held.maps.length>150)
    throw new Error("full_vmmap_snapshot_missing");
  var pid=n.call("getpid",[]);
  if (pid.high!==0 || pid.value!==held.pid)
    throw new Error("page_identity_changed");
  var maps=held.maps;
  checks=[];
  for (var g=0;g<6;g++) {
    var start=72+g*13;
    var rows=maps.slice(start,start+13).map(function(m){
      return m.start.toString(16)+"+"+(m.end-m.start).toString(16)+
        "/"+m.prot.toString(16)+"/"+m.type.toString(16);
    }).join("|");
    var details={rows:rows};
    if (g===0) {details.pid=pid.value;details.count=maps.length;}
    checks.push({id:"full_vmmap_tail_"+g+"_v1",status:"pass",details:details});
  }
} catch(error) {
  checks=[];
  for (var h=0;h<6;h++) checks.push({id:"full_vmmap_tail_"+h+"_v1",
    status:"error",details:{phase:phase,error:String(error).slice(0,180)}});
}
return checks;
