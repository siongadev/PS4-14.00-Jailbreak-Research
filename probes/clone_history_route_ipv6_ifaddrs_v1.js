// Request kernel-selected IPv6 interface address and inspect aligned bytes.
var result,phase="preflight",frame,saved,fd=-1,base=0x1800,span=0x900;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys97!=="number"||
      typeof native.wrappers.sys209!=="number"||
      typeof native.wrappers.write!=="number"||
      typeof native.wrappers.read!=="number"||
      typeof native.wrappers.close!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1)throw new Error("pid_invalid");
  phase="route_open";
  var opened=native.call("sys97",[17,3,0,0,0,0]);
  var openErr=opened.value===-1?native.readErrno():0;
  if(opened.high!==0||opened.value<0||opened.value>=1024)
    throw new Error("route_open_"+opened.value+"_"+openErr);
  fd=opened.value;
  frame.fill(0,base,base+184);
  frame[base]=184;frame[base+2]=5;frame[base+3]=4;
  frame[base+12]=0x31;frame[base+20]=28;
  frame[base+152]=28;frame[base+153]=28;
  frame[base+175]=1; // ::1 in sockaddr_in6 at offset 8..23
  phase="send";
  if(api&&typeof api.markSync==="function")api.markSync("route_ipv6_ifa_before_write");
  var sent=native.call("write",[fd,native.frameAddress+base,184,0,0,0]);
  var sendErr=sent.value===-1?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("route_ipv6_ifa_after_write");
  frame.fill(0,base+0x200,base+0x208);
  frame[base+0x200]=fd&255;frame[base+0x201]=(fd>>>8)&255;
  frame[base+0x204]=1; // POLLIN
  phase="poll";
  var waited=native.call("sys209",[native.frameAddress+base+0x200,1,100,0,0,0]);
  var pollErr=waited.value===-1?native.readErrno():0;
  var revents=frame[base+0x206]+256*frame[base+0x207];
  var got="none",reply="";
  frame.fill(0xa5,base+0x300,base+0x500);
  frame.fill(0x5a,base+0x500,base+span);
  if(waited.value>0&&(revents&1)){
    phase="read";
    var read=native.call("read",[fd,native.frameAddress+base+0x300,0x200,0,0,0]);
    var readErr=read.value===-1?native.readErrno():0;
    got=read.value+"/"+readErr;
    if(read.value>0){
      var head=[];
      for(var h=0;h<Math.min(read.value,512);h++)
        head.push((frame[base+0x300+h]+256).toString(16).slice(-2));
      reply=head.join("");
    }
  }
  var guard=true;
  for(var g=base+0x500;g<base+span;g++)if(frame[g]!==0x5a)guard=false;
  phase="close";
  var closed=native.call("close",[fd,0,0,0,0,0]);
  var closeErr=closed.value===-1?native.readErrno():0;
  fd=-1;
  var end=native.call("getpid",[]);
  result={id:"route_ipv6_ifaddrs_v1",
    status:guard&&closed.value===0&&end.high===0&&end.value===pid.value?"pass":"fail",
    details:{summary:pid.value+":"+sent.value+"/"+sendErr+":"+
      waited.value+"/"+pollErr+"/"+revents+":"+got+":"+
      closed.value+"/"+closeErr+":"+guard,
      reply0:reply.slice(0,128),reply1:reply.slice(128,256),
      reply2:reply.slice(256,384),reply3:reply.slice(384,512),
      reply4:reply.slice(512,640),reply5:reply.slice(640,768),
      reply6:reply.slice(768,896),reply7:reply.slice(896,1024)}};
}catch(error){result={id:"route_ipv6_ifaddrs_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{
  if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
  if(fd>=0&&window.__fw14NativeInvoke)
    try{window.__fw14NativeInvoke.call("close",[fd,0,0,0,0,0]);}catch(ignore){}
}
return [result];
