// Ordinary RTM_GET with RTA_DST and bounded RTA_AUTHOR. The two valid
// author lengths test whether the reply retains that user-supplied field.
var result,phase="preflight",frame,saved,fd=-1,base=0x1800,span=0xa00;
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
  function trial(authorLen,label){
    phase="open_"+label;
    var opened=native.call("sys97",[17,3,0,0,0,0]);
    var openErr=opened.value===-1?native.readErrno():0;
    if(opened.value<0||opened.value>=1024||opened.high!==0)
      throw new Error("route_open_"+opened.value+"_"+openErr);
    fd=opened.value;
    var msgLen=168+authorLen;
    frame.fill(0,base,base+msgLen);
    frame[base]=msgLen&255;frame[base+1]=msgLen>>>8;
    frame[base+2]=5;frame[base+3]=4;
    frame[base+12]=0x41; // RTA_DST | RTA_AUTHOR
    frame[base+20]=authorLen;
    frame[base+152]=16;frame[base+153]=2;
    frame[base+156]=127;frame[base+159]=1;
    frame[base+168]=authorLen;frame[base+169]=2;
    frame[base+172]=127;frame[base+175]=1;
    phase="write_"+label;
    if(api&&typeof api.markSync==="function")api.markSync("route_author_before_"+label);
    var sent=native.call("write",[fd,native.frameAddress+base,msgLen,0,0,0]);
    var sendErr=sent.value===-1?native.readErrno():0;
    if(api&&typeof api.markSync==="function")api.markSync("route_author_after_"+label);
    frame.fill(0,base+0x200,base+0x208);
    frame[base+0x200]=fd&255;frame[base+0x201]=(fd>>>8)&255;
    frame[base+0x204]=1;
    phase="poll_"+label;
    var waited=native.call("sys209",[native.frameAddress+base+0x200,1,100,0,0,0]);
    var pollErr=waited.value===-1?native.readErrno():0;
    var revents=frame[base+0x206]+256*frame[base+0x207];
    frame.fill(0xa5,base+0x300,base+0x700);
    frame.fill(0x5a,base+0x700,base+span);
    var got="none",tail="";
    if(waited.value>0&&(revents&1)){
      phase="read_"+label;
      var read=native.call("read",[fd,native.frameAddress+base+0x300,0x400,0,0,0]);
      var readErr=read.value===-1?native.readErrno():0;
      got=read.value+"/"+readErr;
      if(read.value>152){
        var bytes=[];
        for(var h=152;h<Math.min(read.value,248);h++)
          bytes.push((frame[base+0x300+h]+256).toString(16).slice(-2));
        tail=bytes.join("");
      }
    }
    var guard=true;
    for(var g=base+0x700;g<base+span;g++)if(frame[g]!==0x5a)guard=false;
    phase="close_"+label;
    var closed=native.call("close",[fd,0,0,0,0,0]);
    var closeErr=closed.value===-1?native.readErrno():0;
    fd=-1;
    return {summary:label+":"+sent.value+"/"+sendErr+"/"+
      waited.value+"/"+pollErr+"/"+revents+"/"+got+"/"+
      closed.value+"/"+closeErr+"/"+guard,tail:tail,
      clean:guard&&closed.value===0};
  }
  var one=trial(16,"a16"),two=trial(24,"a24");
  var end=native.call("getpid",[]);
  result={id:"route_author_control_v1",
    status:one.clean&&two.clean&&end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,case16:one.summary,case24:two.summary,
      tail16:one.tail,tail24:two.tail}};
}catch(error){result={id:"route_author_control_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{
  if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
  if(fd>=0&&window.__fw14NativeInvoke)
    try{window.__fw14NativeInvoke.call("close",[fd,0,0,0,0,0]);}catch(ignore){}
}
return [result];
