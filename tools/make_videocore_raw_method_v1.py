"""Make a raw IPMI method control from the proven live-client locator.

This copies only the guarded 14.00 live-client locator, then compares the
source-defined VideoCore wrapper with its equivalent 48-byte raw packet.
"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def main() -> None:
    source = (PROBES / "clone_history_videocore_live_peer_v1.js").read_text(
        encoding="utf-8"
    )
    prefix, sep, _ = source.partition("  var o=0x500,saved=")
    if not sep or "client_vtable_or_kid_invalid" not in prefix:
        raise ValueError("live-client locator changed")
    suffix = r'''  var o=0x500,saved=Array.from(f.subarray(o,o+0x100));
  var official=null,raw=null,rawErrno=0,sysResult=0,methodResult=0,
    officialOutput=0,rawOutput=0,guard=false;
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  function put64(off,v){
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  try {
    f.fill(0xa5,o,o+0x100);
    phase="official_control";
    if(api&&api.markSync)api.markSync("videocore_raw_official_before");
    official=n.call("videocore_query17",[client,n.frameAddress+0x528]);
    if(api&&api.markSync)api.markSync("videocore_raw_official_after");
    officialOutput=dv.getUint32(0x528,true);
    if(official.value!==0||official.high!==0||officialOutput===0xa5a5a5a5)
      throw new Error("official_control_changed_"+official.value+"_"+
        official.high+"_"+officialOutput);
    f.fill(0xa5,o,o+0x100);
    dv.setUint32(0x500,0,true);
    dv.setUint32(0x520,0,true);
    put64(0x530,n.frameAddress+0x528);
    put64(0x538,4);
    dv.setUint32(0x540,0x12340017,true);
    dv.setUint32(0x544,0,true);  // input descriptor count
    dv.setUint32(0x548,1,true);  // output descriptor count
    dv.setUint32(0x54c,0,true);
    put64(0x550,0);              // no input descriptor
    put64(0x558,n.frameAddress+0x530);
    put64(0x560,n.frameAddress+0x520);
    put64(0x568,1);              // final word in 14.00 IPMI wrapper
    phase="raw_method";
    if(api&&api.markSync)api.markSync("videocore_raw_method_before");
    raw=n.call("sys622",[0x320,kid,n.frameAddress+0x500,
      n.frameAddress+0x540,0x30,0]);
    if(api&&api.markSync)api.markSync("videocore_raw_method_after");
    rawErrno=raw.value===-1?n.readErrno():0;
    sysResult=dv.getUint32(0x500,true);
    methodResult=dv.getUint32(0x520,true);
    rawOutput=dv.getUint32(0x528,true);
    guard=Array.from(f.subarray(0x52c,0x530)).every(function(x){return x===0xa5;});
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"videocore_raw_method_v1",status:restored&&guard&&raw&&
    raw.value===0&&sysResult===0&&methodResult===0&&rawOutput===officialOutput+1?
    "pass":"fail",details:{pid:pid.value,kid:kid,
      official_ret:official&&official.value,official_output:officialOutput,
      raw_ret:raw&&raw.value,raw_errno:rawErrno,sys_result:sysResult,
      method_result:methodResult,raw_output:rawOutput,guard:guard,restored:restored}};
} catch(error) {
  result={id:"videocore_raw_method_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
'''
    target = PROBES / "clone_history_videocore_raw_method_v4.js"
    target.write_text(prefix + suffix.replace("videocore_raw_method_v1", "videocore_raw_method_v4"), encoding="utf-8")
    (PROBES / "clone_history_videocore_raw_method_v4.json").write_text(
        '{"probe_id":"clone_history_videocore_raw_method_v4",'
        '"script":"clone_history_videocore_raw_method_v4.js",'
        '"check_ids":["videocore_raw_method_v4"],"timeout_ms":30000}\n',
        encoding="utf-8",
    )
    print(target, target.stat().st_size)


if __name__ == "__main__":
    main()
