"""Package repeated owned Unix descriptor-passing error-path writes."""

import argparse
from pathlib import Path


root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--variant", choices=("v4", "v5"), default="v4")
args = parser.parse_args()
source = (root / "probes" / f"clone_history_unix_rights_error_{args.variant}.js").read_text()
burst = """function oneAttempt(){
""" + source + """
}
var attempted=0,normal40=0,emfile24=0,goodPayload=0,goodTail=0;
var anomalyAt=-1,anomalyDetail="";
if(api&&typeof api.markSync==="function")api.markSync("rights_burst_start");
for(var i=0;i<64;i++){
  var result=oneAttempt()[0];
  attempted++;
  var d=result&&result.details;
  if(!d){anomalyAt=i;anomalyDetail="missing_result";break;}
  if(d.first_errno===40)normal40++;
  if(d.first_errno===24)emfile24++;
  if(d.payload_ok===true)goodPayload++;
  if(d.tail_ok===true)goodTail++;
  if(result.status!=="pass"||d.first_errno!==40||
     d.cleanup_ok!==true||d.guards_intact!==true){
    anomalyAt=i;
    anomalyDetail=JSON.stringify({status:result.status,details:d}).slice(0,500);
    break;
  }
  if((i+1)%16===0&&api&&typeof api.markSync==="function")
    api.markSync("rights_burst_"+(i+1));
}
return [{id:"unix_rights_error_burst_v1",
  status:anomalyAt>=0?"fail":"pass",
  details:{attempted:attempted,normal_40:normal40,emfile_24:emfile24,
    payload_ok:goodPayload,tail_ok:goodTail,
    anomaly_at:anomalyAt,anomaly_detail:anomalyDetail}}];
"""
if args.variant == "v5":
    burst = burst.replace("unix_rights_error_burst_v1",
                          "unix_rights_error_burst_large_v1")
target_name = ("clone_history_unix_rights_error_burst_v1.js"
               if args.variant == "v4" else
               "clone_history_unix_rights_error_burst_large_v1.js")
target = root / "probes" / target_name
target.write_bytes(burst.encode("utf-8"))
print(f"{target}: {target.stat().st_size} bytes")
