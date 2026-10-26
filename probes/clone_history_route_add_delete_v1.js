// Test whether the browser may add a TEST-NET route, verify it from a
// second routing socket, delete it, and independently verify removal.
var result,phase="preflight",frame,saved,fdA=-1,fdB=-1;
var base=0x1800,span=0x1000,possiblyAdded=false,deleteAttempted=false;
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
  if(base+span>frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));

  function put16(at,value){
    frame[at]=value&255;frame[at+1]=(value>>>8)&255;
  }
  function put32(at,value){
    frame[at]=value&255;frame[at+1]=(value>>>8)&255;
    frame[at+2]=(value>>>16)&255;frame[at+3]=(value>>>24)&255;
  }
  function get16(at){return frame[at]+256*frame[at+1];}
  function get32(at){
    return (frame[at]|(frame[at+1]<<8)|(frame[at+2]<<16)|
      (frame[at+3]<<24))>>>0;
  }
  function getS32(at){return get32(at)|0;}
  function sockaddr4(at,a,b,c,d){
    frame.fill(0,at,at+16);frame[at]=16;frame[at+1]=2;
    frame[at+4]=a;frame[at+5]=b;frame[at+6]=c;frame[at+7]=d;
  }
  function buildGet(seq){
    frame.fill(0,base,base+0x200);
    put16(base,168);frame[base+2]=5;frame[base+3]=4;
    put32(base+12,1);put32(base+20,seq);
    sockaddr4(base+152,198,51,100,1);
    return 168;
  }
  function buildChange(type,seq){
    frame.fill(0,base,base+0x200);
    put16(base,192);frame[base+2]=5;frame[base+3]=type;
    put32(base+8,3);       // RTF_UP | RTF_GATEWAY
    put32(base+12,7);      // DST | GATEWAY | NETMASK
    put32(base+20,seq);
    sockaddr4(base+152,198,51,100,0);
    sockaddr4(base+168,127,0,0,1);
    // FreeBSD route(8) trims 255.255.255.0 to a 7-byte sockaddr,
    // which still occupies one aligned 8-byte routing-message slot.
    frame.fill(0,base+184,base+192);
    frame[base+184]=7;frame[base+185]=2;
    frame[base+188]=255;frame[base+189]=255;frame[base+190]=255;
    return 192;
  }
  function pollRead(fd,timeout){
    var pollAt=base+0x300,replyAt=base+0x400;
    frame.fill(0,pollAt,pollAt+8);
    put16(pollAt,fd);put16(pollAt+4,1);
    var waited=native.call("sys209",[native.frameAddress+pollAt,1,timeout,0,0,0]);
    var pollErr=waited.value===-1?native.readErrno():0;
    var revents=get16(pollAt+6);
    if(waited.high!==0||waited.value<=0||(revents&1)===0)
      return {bytes:0,poll:waited.value,errno:pollErr,revents:revents};
    frame.fill(0xa5,replyAt,replyAt+0x800);
    var read=native.call("read",[fd,native.frameAddress+replyAt,0x800,0,0,0]);
    var readErr=read.value===-1?native.readErrno():0;
    return {bytes:read.value,readHigh:read.high,errno:readErr,
      poll:waited.value,pollErr:pollErr,revents:revents,at:replyAt};
  }
  function drain(fd){
    var count=0;
    for(var i=0;i<8;i++){
      var item=pollRead(fd,0);
      if(item.bytes<=0)break;
      count++;
    }
    return count;
  }
  function addressAt(at,saLen){
    var octets=[0,0,0,0];
    for(var i=0;i<4;i++)if(4+i<saLen)octets[i]=frame[at+4+i];
    return octets.join(".");
  }
  function parseReply(at,total,wantSeq){
    var offset=0;
    while(offset+152<=total){
      var msgLen=get16(at+offset);
      if(msgLen<152||offset+msgLen>total)break;
      var version=frame[at+offset+2],type=frame[at+offset+3];
      var seq=getS32(at+offset+20),pid=getS32(at+offset+16);
      if(version===5&&type===4&&seq===wantSeq){
        var addrs=get32(at+offset+12),p=at+offset+152;
        var limit=at+offset+msgLen,values=[null,null,null];
        var families=[null,null,null],lengths=[null,null,null];
        for(var bit=0;bit<8;bit++)if(addrs&(1<<bit)){
          if(p>=limit)break;
          var saLen=frame[p],slot=saLen===0?8:((saLen+7)&~7);
          var family=p+1<limit?frame[p+1]:-1;
          if(bit<3){
            families[bit]=family;lengths[bit]=saLen;
            if(family===2||(bit===2&&family===0))
              values[bit]=addressAt(p,saLen);
          }
          p+=slot;
        }
        var exact=values[0]==="198.51.100.0"&&
          values[1]==="127.0.0.1"&&values[2]==="255.255.255.0";
        return {found:true,exact:exact,msglen:msgLen,flags:get32(at+offset+8),
          addrs:addrs,pid:pid,seq:seq,rtm_errno:getS32(at+offset+24),
          dst:values[0],gateway:values[1],netmask:values[2],
          families:families,lengths:lengths};
      }
      offset+=msgLen;
    }
    return null;
  }
  function query(fd,seq){
    var drained=drain(fd),length=buildGet(seq);
    var sent=native.call("write",[fd,native.frameAddress+base,length,0,0,0]);
    var sendErr=sent.value===-1?native.readErrno():0;
    if(sent.high!==0||sent.value!==length)
      return {sent:sent.value,errno:sendErr,drained:drained,reply:null};
    for(var i=0;i<12;i++){
      var item=pollRead(fd,100);
      if(item.bytes<=0)continue;
      var parsed=parseReply(item.at,item.bytes,seq);
      if(parsed)return {sent:sent.value,errno:sendErr,drained:drained,
        reply:parsed};
    }
    return {sent:sent.value,errno:sendErr,drained:drained,reply:null};
  }
  function change(fd,type,seq){
    var length=buildChange(type,seq);
    var call=native.call("write",[fd,native.frameAddress+base,length,0,0,0]);
    return {value:call.value,high:call.high,
      errno:call.value===-1?native.readErrno():0};
  }
  function closeFd(fd){
    var call=native.call("close",[fd,0,0,0,0,0]);
    return {value:call.value,errno:call.value===-1?native.readErrno():0};
  }
  function querySummary(queryResult){
    if(!queryResult.reply)return queryResult.sent+"/"+queryResult.errno+"/no_reply";
    var reply=queryResult.reply;
    return queryResult.sent+"/"+queryResult.errno+"/rtm="+reply.rtm_errno+
      "/dst="+(reply.dst||"none")+"/gw="+(reply.gateway||"none")+
      "/mask="+(reply.netmask||"none")+"/flags="+reply.flags;
  }

  var startPid=native.call("getpid",[]);
  if(startPid.high!==0||startPid.value<1)throw new Error("pid_invalid");
  phase="open_route_sockets";
  var openedA=native.call("sys97",[17,3,0,0,0,0]);
  var openAErr=openedA.value===-1?native.readErrno():0;
  if(openedA.high!==0||openedA.value<0||openedA.value>=1024)
    throw new Error("route_a_open_"+openedA.value+"_"+openAErr);
  fdA=openedA.value;
  var openedB=native.call("sys97",[17,3,0,0,0,0]);
  var openBErr=openedB.value===-1?native.readErrno():0;
  if(openedB.high!==0||openedB.value<0||openedB.value>=1024)
    throw new Error("route_b_open_"+openedB.value+"_"+openBErr);
  fdB=openedB.value;

  phase="precheck";
  var pre=query(fdB,0x514001);
  if(!pre.reply)throw new Error("precheck_no_reply");
  if(pre.reply.exact)throw new Error("target_route_preexists");

  phase="add";
  if(api&&typeof api.markSync==="function")api.markSync("route_add_before");
  var add=change(fdA,1,0x514002);
  if(api&&typeof api.markSync==="function")api.markSync("route_add_after");
  possiblyAdded=add.high===0&&add.value===192;

  phase="verify_add";
  var afterAdd=query(fdB,0x514003);
  var observed=!!(afterAdd.reply&&afterAdd.reply.exact);

  phase="delete";
  var del={value:"not_run",errno:0};
  if(possiblyAdded||observed){
    if(api&&typeof api.markSync==="function")api.markSync("route_delete_before");
    deleteAttempted=true;
    del=change(fdA,2,0x514004);
    if(api&&typeof api.markSync==="function")api.markSync("route_delete_after");
  }

  phase="verify_delete";
  var afterDelete=query(fdB,0x514005);
  var remains=!!(afterDelete.reply&&afterDelete.reply.exact);
  var cleanupConfirmed=!!afterDelete.reply&&!remains;
  var closeA=closeFd(fdA);fdA=-1;
  var closeB=closeFd(fdB);fdB=-1;
  var endPid=native.call("getpid",[]);
  var guard=true;
  for(var g=base+0xc00;g<base+span;g++)if(frame[g]!==saved[g-base])guard=false;
  var classification;
  if(observed&&!remains&&del.value===192)classification="authority_confirmed_cleaned";
  else if(observed&&remains)classification="cleanup_failed";
  else if(!afterDelete.reply)classification="cleanup_unverified";
  else if(add.value===-1&&(add.errno===1||add.errno===13))classification="denied";
  else if(possiblyAdded&&!observed)classification="accepted_without_route_effect";
  else classification="no_route_effect";
  var safe=guard&&closeA.value===0&&closeB.value===0&&
    endPid.high===0&&endPid.value===startPid.value&&cleanupConfirmed;
  result={id:"route_table_write_v1",status:safe?"pass":"fail",details:{
    classification:classification,pid:startPid.value,
    pre:querySummary(pre),add:add.value+"/"+add.errno,
    after_add:querySummary(afterAdd),delete:del.value+"/"+del.errno,
    after_delete:querySummary(afterDelete),
    route_observed:observed,route_remains:remains,
    cleanup_confirmed:cleanupConfirmed,guard:guard,
    close:closeA.value+"/"+closeA.errno+","+closeB.value+"/"+closeB.errno}};
}catch(error){
  result={id:"route_table_write_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,200)}};
}finally{
  if(possiblyAdded&&!deleteAttempted&&fdA>=0&&window.__fw14NativeInvoke){
    try{buildChange(2,0x5140ff);window.__fw14NativeInvoke.call("write",
      [fdA,window.__fw14NativeInvoke.frameAddress+base,192,0,0,0]);}catch(ignore){}
  }
  if(fdA>=0&&window.__fw14NativeInvoke)
    try{window.__fw14NativeInvoke.call("close",[fdA,0,0,0,0,0]);}catch(ignore){}
  if(fdB>=0&&window.__fw14NativeInvoke)
    try{window.__fw14NativeInvoke.call("close",[fdB,0,0,0,0,0]);}catch(ignore){}
  if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
}
return [result];
