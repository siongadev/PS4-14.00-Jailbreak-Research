"""Build an LNC status raw-IPMI comparison from a live client locator."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROBES = ROOT / "probes"


def replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise ValueError(f"expected one source anchor: {old!r}")
    return source.replace(old, new)


def main() -> None:
    source = (PROBES / "clone_history_videocore_live_peer_v1.js").read_text(
        encoding="utf-8"
    )
    prefix, sep, _ = source.partition('  phase="live_client_read";')
    if not sep:
        raise ValueError("live-client locator anchor changed")
    prefix = replace_once(prefix, "!n.wrappers.sys622||", "!n.wrappers.sys622||!n.wrappers.service_status||")
    prefix = replace_once(prefix, 'x.handle===61&&', 'x.handle===49&&')
    prefix = replace_once(prefix, 'x.name==="libSceVideoCoreServerInterface.sprx"',
                          'x.name==="libSceSystemService.sprx"')
    prefix = replace_once(prefix, 'x.kind==="rw"&&x.size===32768',
                          'x.kind==="rw"&&x.size===16384')
    suffix = r'''  var o=0x500,saved=Array.from(f.subarray(o,o+0x100));
  var official=null,raw=null,rawErrno=0,sysResult=0,methodResult=0,
    officialHex="",rawHex="",guard=false,client=0,kid=0,vtable=0;
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
    f.fill(0xa5,o,o+0x100);
    phase="official_status";
    if(api&&api.markSync)api.markSync("lnc_raw_official_before");
    official=n.call("service_status",[n.frameAddress+0x580]);
    if(api&&api.markSync)api.markSync("lnc_raw_official_after");
    officialHex=hexAt(0x580,12);
    if(official.value!==0||official.high!==0||officialHex==="a5a5a5a5a5a5a5a5a5a5a5a5")
      throw new Error("official_status_unavailable_"+official.value);
    phase="live_client_read";
    client=valueOf(readAt(rw.start+0x60,8));
    if(client<rw.start+0x68||client+16>rw.start+rw.size)
      throw new Error("service_client_not_module_owned");
    var head=readAt(client,16);
    vtable=valueOf(head.slice(0,8));
    kid=valueOf(head.slice(8,12));
    if(vtable!==ro.start+0x10||kid<=0||kid>0xffffffff)
      throw new Error("service_client_identity_invalid");
    f.fill(0xa5,o,o+0x100);
    dv.setUint32(0x500,0,true);
    dv.setUint32(0x520,0,true);
    put64(0x530,n.frameAddress+0x580);
    put64(0x538,12);
    dv.setUint32(0x540,0x30013,true);
    dv.setUint32(0x544,0,true);
    dv.setUint32(0x548,1,true);
    dv.setUint32(0x54c,0,true);
    put64(0x550,0);
    put64(0x558,n.frameAddress+0x530);
    put64(0x560,n.frameAddress+0x520);
    put64(0x568,1);
    phase="raw_status";
    if(api&&api.markSync)api.markSync("lnc_raw_method_before");
    raw=n.call("sys622",[0x320,kid,n.frameAddress+0x500,
      n.frameAddress+0x540,0x30,0]);
    if(api&&api.markSync)api.markSync("lnc_raw_method_after");
    rawErrno=raw.value===-1?n.readErrno():0;
    sysResult=dv.getUint32(0x500,true);
    methodResult=dv.getUint32(0x520,true);
    rawHex=hexAt(0x580,12);
    guard=Array.from(f.subarray(0x58c,0x590)).every(function(x){return x===0xa5;});
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    original.every(function(x,i){return forged[slot+i]===x;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"lnc_raw_status_v1",status:restored&&guard&&raw&&
    raw.value===0&&sysResult===0&&methodResult===0&&rawHex===officialHex?
    "pass":"fail",details:{pid:pid.value,kid:kid,
      official_ret:official&&official.value,official_hex:officialHex,
      raw_ret:raw&&raw.value,raw_errno:rawErrno,sys_result:sysResult,
      method_result:methodResult,raw_hex:rawHex,guard:guard,restored:restored}};
} catch(error) {
  result={id:"lnc_raw_status_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
'''
    target = PROBES / "clone_history_lnc_raw_status_v1.js"
    target.write_text(prefix + suffix, encoding="utf-8")
    (PROBES / "clone_history_lnc_raw_status_v1.json").write_text(
        '{"probe_id":"clone_history_lnc_raw_status_v1",'
        '"script":"clone_history_lnc_raw_status_v1.js",'
        '"check_ids":["lnc_raw_status_v1"],"timeout_ms":30000}\n',
        encoding="utf-8",
    )
    print(target, target.stat().st_size)


if __name__ == "__main__":
    main()
