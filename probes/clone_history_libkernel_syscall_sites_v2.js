// Census all syscall opcodes in the page-local, VM-verified RX range.
var state=window.__fw14ArrayState,plan=window.__fw14NativePlan;
var held=window.__fw14LibkernelRange,result,slot=-1,original=[];
try{
  if(!state||!plan||!held||!state.view||!state.array||!state.a||
      !state.ownedTypedView||state.array[0]!==state.a||
      !Number.isSafeInteger(state.calibratedViewBase)||
      !Number.isSafeInteger(plan.target)||held.target!==plan.target||
      held.pid<1||!Number.isSafeInteger(held.start)||
      !Number.isSafeInteger(held.end)||held.start%4096!==0||
      held.end%4096!==0||held.start>plan.target||
      held.end<=plan.target||held.end-held.start<12288||
      held.end-held.start>0x100000)
    throw new Error("held_mapping_missing_or_changed");
  var forged=state.view,carrier=state.ownedTypedView;
  var base=state.calibratedViewBase;
  if(carrier.length!==65536||carrier[0]!==0x31||
      carrier[7]!==0xa8||base%4096!==0)
    throw new Error("carrier_canary_changed");
  function bytesAt(index,count){var out=[];
    for(var n=0;n<count;n++)out.push(forged[index+n]);return out;}
  function hexLE(bytes){var out="0x";
    for(var n=bytes.length-1;n>=0;n--)
      out+=bytes[n].toString(16).padStart(2,"0");
    return out;}
  function hexForward(bytes){var out="";
    for(var n=0;n<bytes.length;n++)
      out+=bytes[n].toString(16).padStart(2,"0");
    return out;}
  function wordOf(value){try{state.array[0]=value;
    return Number(hexLE(bytesAt(state.index,8)));
  }finally{state.array[0]=state.a;}}
  var index=wordOf(carrier)-base;
  if(!Number.isSafeInteger(index)||index<0||index+15>=16777216)
    throw new Error("carrier_cell_outside_window");
  slot=index+8;original=bytesAt(slot,8);
  function pointerBytes(address){
    if(!Number.isSafeInteger(address)||address<=0)
      throw new Error("read_address_invalid");
    var out=[];
    for(var n=0;n<8;n++)
      out.push(Math.floor(address/Math.pow(2,n*8))&255);
    return out;
  }
  function readAddress(address,count){
    if(address<held.start||address+count>held.end||count>65536)
      throw new Error("read_outside_verified_mapping");
    var next=pointerBytes(address);
    try{
      for(var n=0;n<8;n++)forged[slot+n]=next[n];
      var out=[];
      for(var r=0;r<count;r++)out.push(carrier[r]);
      return out;
    }finally{
      for(var x=0;x<8;x++)forged[slot+x]=original[x];
    }
  }
  if(hexForward(readAddress(plan.target,16))!==
      "48c7c0140000004989ca0f057201c348")
    throw new Error("live_number20_signature_changed");
  var total=0,standard=0,extra=0,examples=[];
  if(api&&typeof api.markSync==="function")
    api.markSync("libkernel_sites_start");
  for(var pos=held.start;pos<held.end;pos+=0x8000){
    var start=Math.max(held.start,pos-16);
    var end=Math.min(held.end,pos+0x8000+16);
    var page=readAddress(start,end-start);
    var scanStart=pos-start;
    var scanEnd=Math.min(held.end-1,pos+0x8000)-start;
    for(var i=scanStart;i<scanEnd;i++){
      if(page[i]!==0x0f||page[i+1]!==0x05)continue;
      total++;
      var usual=i>=10&&i+4<page.length&&
        page[i-10]===0x48&&page[i-9]===0xc7&&
        page[i-8]===0xc0&&page[i-3]===0x49&&
        page[i-2]===0x89&&page[i-1]===0xca&&
        page[i+2]===0x72&&page[i+3]===0x01&&
        page[i+4]===0xc3;
      if(usual){standard++;continue;}
      extra++;
      if(examples.length<12){
        var from=Math.max(0,i-20),to=Math.min(page.length,i+20);
        examples.push("0x"+(start+i).toString(16)+":"+
          hexForward(page.slice(from,to)));
      }
    }
  }
  var restored=hexLE(bytesAt(slot,8))===hexLE(original)&&
    carrier[0]===0x31&&carrier[7]===0xa8&&
    state.array[0]===state.a;
  if(api&&typeof api.markSync==="function")
    api.markSync("libkernel_sites_done");
  result={id:"libkernel_syscall_sites_v2",
    status:restored&&standard===293?"pass":"fail",
    details:{range:"0x"+held.start.toString(16)+"-0x"+
      held.end.toString(16),total:total,standard:standard,
      other:extra,examples0:examples.slice(0,4).join(";")||"none",
      examples1:examples.slice(4,8).join(";")||"none",
      examples2:examples.slice(8,12).join(";")||"none",
      restored:restored}};
}catch(error){
  if(slot>=0&&original.length===8&&state&&state.view)
    for(var y=0;y<8;y++)state.view[slot+y]=original[y];
  if(state&&state.array&&state.a)state.array[0]=state.a;
  result={id:"libkernel_syscall_sites_v2",status:"error",
    details:{error:String(error).slice(0,200)}};
}
return [result];
