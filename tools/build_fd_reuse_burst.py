"""Package repeated fd close/reuse attempts within the probe blob size cap."""

import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--variant", choices=("delay2", "delay1", "direct"),
                    default="delay2")
args = parser.parse_args()
variant = args.variant
source_name = ("clone_history_worker_fd_reuse_errno_delay2_v1.js"
               if variant == "delay2" else "clone_history_worker_fd_reuse_errno_v1.js")
source = (ROOT / "probes" / source_name).read_text()
lines = [line.lstrip() for line in source.splitlines()
         if not line.lstrip().startswith("//")]
attempt = "\n".join(lines)
if variant == "direct":
    changes = (
        ('{name:"getpid",args:[]},\n{name:"close",args:[readFd]}',
         '{name:"close",args:[readFd]}'),
        ('delayResult=chained.values[1];\ncloseResult=chained.values[2];\n'
         'replacementResult=chained.values[3];',
         'closeResult=chained.values[1];\nreplacementResult=chained.values[2];'),
        ('delayResult && delayResult.value===expectedPid &&\n'
         'delayResult.high===0 &&\n', ''),
    )
    for old, new in changes:
        assert old in attempt, old
        attempt = attempt.replace(old, new, 1)
prefix = "fd_errno2" if variant == "delay2" else "fd_errno"
for marker in (f"{prefix}_preflight", f"{prefix}_ready",
               f"{prefix}_call_restored", f"{prefix}_restored"):
    attempt = attempt.replace(f'api.markSync("{marker}")', "void 0")
burst = """function oneAttempt(){
""" + attempt + """
}
return (async function(){
var attempted=0,oldSignals=0,replacementSignals=0;
var workerSuccess=0,workerEbadf=0,beforeReturn=0;
var anomalyAt=-1,anomalyDetail="";
if(api&&typeof api.markSync==="function")api.markSync("fd_burst_start");
for(var i=0;i<64;i++){
var checks=await oneAttempt();
attempted++;
var check=checks&&checks[0];
if(!check||!check.details){anomalyAt=i;anomalyDetail="missing_attempt_result";break;}
var d=check.details;
if(d.old_signal)oldSignals++;
if(d.replacement_signal)replacementSignals++;
if(d.add_return===0&&d.worker_errno===0)workerSuccess++;
if(d.add_return===-1&&d.worker_errno===9)workerEbadf++;
if(d.page_chain_before_return)beforeReturn++;
if(check.status!=="pass"||d.old_signal||d.reuse_exact!==true||
d.cleanup_ok!==true||d.guards_intact!==true||d.worker_restored!==true||
(d.add_return!==0&&d.worker_errno!==9)){
anomalyAt=i;
anomalyDetail=JSON.stringify({status:check.status,details:d}).slice(0,500);
break;
}
if((i+1)%16===0&&api&&typeof api.markSync==="function")
api.markSync("fd_burst_"+(i+1));
}
return [{id:"worker_fd_reuse_burst_v1",status:anomalyAt>=0?"fail":"pass",
details:{attempted:attempted,old_signals:oldSignals,
replacement_signals:replacementSignals,worker_success:workerSuccess,
worker_ebadf:workerEbadf,page_before_return:beforeReturn,
anomaly_at:anomalyAt,anomaly_detail:anomalyDetail}}];
})();
"""
if variant != "delay2":
    burst = burst.replace("worker_fd_reuse_burst_v1",
                          f"worker_fd_reuse_burst_{variant}_v1")
target_name = ("clone_history_worker_fd_reuse_burst_v1.js" if variant == "delay2"
               else f"clone_history_worker_fd_reuse_burst_{variant}_v1.js")
target = ROOT / "probes" / target_name
target.write_bytes(burst.encode("utf-8"))
print(f"{target}: {target.stat().st_size} bytes")
