"""Build one-entry 14.00 LNC reboot and ordinary status-list probes."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def main() -> None:
    source = (PROBES / "clone_history_lnc_gpu_status_v1.js").read_text(
        encoding="utf-8")
    prefix, sep, _ = source.partition("  var o=0x500,saved=")
    if not sep or 'x.name==="libSceSystemService.sprx"' not in prefix:
        raise ValueError("LNC client locator changed")
    suffix = r'''  var o=0x500,saved=Array.from(f.subarray(o,0xa40));
  var official=null,raw=null,rawErrno=0,sysResult=0,methodResult=0,
    prefixHex="",outputHex="",changed=0,hash=2166136261,
    guard=false,client=0,kid=0,vtable=0,outCount=0;
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  function put64(off,v){
    dv.setUint32(off,v>>>0,true);
    dv.setUint32(off+4,Math.floor(v/0x100000000)>>>0,true);
  }
  function hexAt(off,len){
    return Array.from(f.subarray(off,off+len)).map(function(x){
      return ("0"+x.toString(16)).slice(-2);
    }).join("");
  }
  try {
    f.fill(0xa5,o,0xa40);
    phase="official_status_control";
    if(api&&api.markSync)api.markSync("lnc_list_control_before");
    official=n.call("service_status",[n.frameAddress+0x580]);
    if(api&&api.markSync)api.markSync("lnc_list_control_after");
    if(official.value!==0||official.high!==0||
       hexAt(0x580,12)==="a5a5a5a5a5a5a5a5a5a5a5a5")
      throw new Error("official_status_unavailable_"+official.value);
    client=valueOf(readAt(rw.start+0x60,8));
    if(client<rw.start+0x68||client+16>rw.start+rw.size)
      throw new Error("service_client_not_module_owned");
    var head=readAt(client,16);
    vtable=valueOf(head.slice(0,8));
    kid=valueOf(head.slice(8,12));
    if(vtable!==ro.start+0x10||kid<=0||kid>0xffffffff)
      throw new Error("service_client_identity_invalid");
    f.fill(0xa5,o,0xa40);
    dv.setUint32(0x500,0,true);
    dv.setUint32(0x520,0,true);
    dv.setUint32(0x580,1,true);
    dv.setUint32(0x584,0,true);
    put64(0x590,n.frameAddress+0x580);
    put64(0x598,4);
    put64(0x5a0,n.frameAddress+0x600);
    put64(0x5a8,0x42c);
    put64(0x5b0,n.frameAddress+0x584);
    put64(0x5b8,4);
    dv.setUint32(0x540,0x3002f,true);
    dv.setUint32(0x544,1,true);
    dv.setUint32(0x548,2,true);
    dv.setUint32(0x54c,0,true);
    put64(0x550,n.frameAddress+0x590);
    put64(0x558,n.frameAddress+0x5a0);
    put64(0x560,n.frameAddress+0x520);
    put64(0x568,1);
    phase="reboot_status_list_method";
    if(api&&api.markSync)api.markSync("lnc_list_method_before");
    raw=n.call("sys622",[0x320,kid,n.frameAddress+0x500,
      n.frameAddress+0x540,0x30,0]);
    if(api&&api.markSync)api.markSync("lnc_list_method_after");
    rawErrno=raw.value===-1?n.readErrno():0;
    sysResult=dv.getUint32(0x500,true);
    methodResult=dv.getUint32(0x520,true);
    outCount=dv.getUint32(0x584,true);
    for(var j=0;j<0x42c;j++){
      var b=f[0x600+j];
      if(b!==0xa5)changed++;
      hash=Math.imul(hash^b,16777619)>>>0;
    }
    prefixHex=hexAt(0x600,64);
    if(raw.value===0&&raw.high===0&&sysResult===0&&methodResult===0)
      outputHex=hexAt(0x600,0x42c);
    guard=Array.from(f.subarray(0xa2c,0xa3c)).every(function(x){return x===0xa5;});
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"lnc_reboot_list_v1",status:restored&&guard?"pass":"fail",
    details:{pid:pid.value,raw_ret:raw&&raw.value,raw_errno:rawErrno,
      sys_result:sysResult,method_result:methodResult,out_count:outCount,
      changed:changed,fnv32:hash,prefix_hex:prefixHex,
      guard:guard,restored:restored}};
  checks=[result];
  for(var chunk=0;chunk<5;chunk++){
    checks.push({id:"lnc_reboot_bytes_"+chunk,status:"pass",
      details:{available:outputHex.length===0x42c*2,
        hex:outputHex.slice(chunk*512,(chunk+1)*512)}});
  }
} catch(error) {
  checks=[{id:"probe_error",status:"error",
    details:{error:(phase+":"+String(error)).slice(0,180)}}];
}
return checks;
'''
    target = PROBES / "clone_history_lnc_reboot_list_v1.js"
    target.write_text(prefix + suffix, encoding="utf-8")
    (PROBES / "clone_history_lnc_reboot_list_v1.json").write_text(
        '{"probe_id":"clone_history_lnc_reboot_list_v1",'
        '"script":"clone_history_lnc_reboot_list_v1.js",'
        '"check_ids":["lnc_reboot_list_v1","lnc_reboot_bytes_0",'
        '"lnc_reboot_bytes_1","lnc_reboot_bytes_2",'
        '"lnc_reboot_bytes_3","lnc_reboot_bytes_4"],'
        '"timeout_ms":30000}\n',
        encoding="utf-8",
    )
    print(target, target.stat().st_size)

    if (suffix.count("0x42c") != 4 or suffix.count("0x3002f") != 1 or
            suffix.count("lnc_reboot_bytes_") != 1):
        raise ValueError("reboot request template changed")
    local_suffix = (suffix.replace("0x3002f", "0x3000f")
                    .replace("0x42c", "0x24")
                    .replace("0xa2c", "0x624")
                    .replace("0xa3c", "0x634")
                    .replace("hexAt(0x600,64)", "hexAt(0x600,0x24)")
                    .replace("lnc_reboot_list_v1", "lnc_local_list_v1")
                    .replace("lnc_reboot_bytes_", "lnc_local_bytes_")
                    .replace("lnc_list_", "lnc_local_")
                    .replace("chunk<5", "chunk<1"))
    local_target = PROBES / "clone_history_lnc_local_list_v1.js"
    local_target.write_text(prefix + local_suffix, encoding="utf-8")
    (PROBES / "clone_history_lnc_local_list_v1.json").write_text(
        '{"probe_id":"clone_history_lnc_local_list_v1",'
        '"script":"clone_history_lnc_local_list_v1.js",'
        '"check_ids":["lnc_local_list_v1","lnc_local_bytes_0"],'
        '"timeout_ms":30000}\n',
        encoding="utf-8",
    )
    print(local_target, local_target.stat().st_size)


if __name__ == "__main__":
    main()
