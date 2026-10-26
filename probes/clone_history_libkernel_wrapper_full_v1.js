// Read only the VM-verified executable mapping containing the live number-20
// wrapper. Report whether the formerly missing entry numbers occur anywhere.
var state=window.__fw14ArrayState,plan=window.__fw14NativePlan;
var held=window.__fw14LibkernelRange,result,slot=-1,original=[];
try{
  if(!state||!plan||!held||!state.view||!state.array||!state.a||
      !state.ownedTypedView||state.array[0]!==state.a||
      !Number.isSafeInteger(state.calibratedViewBase)||
      !Number.isSafeInteger(plan.target)||
      held.target!==plan.target||held.pid<1||
      !Number.isSafeInteger(held.start)||
      !Number.isSafeInteger(held.end)||
      held.start%4096!==0||held.end%4096!==0||
      held.start>plan.target||held.end<=plan.target||
      held.end-held.start<12288||held.end-held.start>0x100000)
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
  var seen={},hits=[],allNumbers={},count=0,outside=0;
  var targets={221:true,222:true,510:true,518:true,571:true};
  var nearStart=plan.target-0xb60-4096;
  var nearEnd=plan.target-0xb60+8192;
  if(api&&typeof api.markSync==="function")
    api.markSync("libkernel_full_scan_start");
  for(var pos=held.start;pos<held.end;pos+=0x8000){
    var size=Math.min(0x8000+14,held.end-pos);
    var page=readAddress(pos,size);
    for(var o=0;o<=page.length-15;o++){
      if(page[o]!==0x48||page[o+1]!==0xc7||page[o+2]!==0xc0||
          page[o+7]!==0x49||page[o+8]!==0x89||page[o+9]!==0xca||
          page[o+10]!==0x0f||page[o+11]!==0x05||
          page[o+12]!==0x72||page[o+13]!==0x01||page[o+14]!==0xc3)
        continue;
      var at=pos+o;
      if(seen[at])continue;
      seen[at]=true;
      var num=page[o+3]+page[o+4]*256+page[o+5]*65536+
        page[o+6]*16777216;
      count++;allNumbers[num]=true;
      if(at<nearStart||at>=nearEnd)outside++;
      if(targets[num])hits.push(num+"@0x"+at.toString(16));
    }
  }
  var restored=hexLE(bytesAt(slot,8))===hexLE(original)&&
    carrier[0]===0x31&&carrier[7]===0xa8&&state.array[0]===state.a;
  if(api&&typeof api.markSync==="function")
    api.markSync("libkernel_full_scan_done");
  result={id:"libkernel_wrapper_full_v1",
    status:restored&&count>=293?"pass":"fail",
    details:{range:"0x"+held.start.toString(16)+"-0x"+
      held.end.toString(16),bytes:held.end-held.start,
      wrapper_count:count,unique_numbers:Object.keys(allNumbers).length,
      outside_old_window:outside,target_hits:hits.join(",")||"none",
      restored:restored}};
}catch(error){
  if(slot>=0&&original.length===8&&state&&state.view)
    for(var y=0;y<8;y++)state.view[slot+y]=original[y];
  if(state&&state.array&&state.a)state.array[0]=state.a;
  result={id:"libkernel_wrapper_full_v1",status:"error",
    details:{error:String(error).slice(0,200)}};
}
return [result];
