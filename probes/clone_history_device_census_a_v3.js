// Read-only open/close census of fixed device paths in captured 14.00 modules.
// No ioctl, read, write, or mmap is issued. /dev/null is a positive control.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,f=n&&n.frame;
  if(!n||!s||s.array[0]!==s.a||!f||f.length<0x1100||
     !Number.isSafeInteger(n.frameAddress)||!n.wrappers.open||!n.wrappers.close)
    throw new Error("native_plan_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  var po=0x1000,saved=Array.from(f.subarray(po,po+64));
  var paths=["/dev/null","/dev/console","/dev/deci_coredump","/dev/deci_tty6",
    "/dev/evlg0","/dev/evlg1","/dev/gbase","/dev/icc_configuration",
    "/dev/icc_device_power","/dev/icc_fan"];
  var rows=[];
  try {
    for(var x=0;x<paths.length;x++){
      var path=paths[x],opened=null,closed=null,err=0,closeErr=0;
      f.fill(0,po,po+64);
      for(var i=0;i<path.length;i++)f[po+i]=path.charCodeAt(i);
      phase="open_"+x;
      if(api&&api.markSync&&(x===0||x===5))api.markSync("device_a_"+x+"_before");
      opened=n.call("open",[n.frameAddress+po,0,0]);
      if(opened.value===-1)err=n.readErrno();
      if(opened.high===0&&opened.value>=3&&opened.value<1024){
        phase="close_"+x;
        closed=n.call("close",[opened.value]);
        if(closed.value===-1)closeErr=n.readErrno();
      }
      rows.push({path:path,open:opened.value,high:opened.high,errno:err,
        close:closed?closed.value:null,close_errno:closeErr});
      if(!((opened.value===-1&&opened.high===0xffffffff&&err>0)||
           (opened.high===0&&opened.value>=3&&opened.value<1024&&
            closed&&closed.value===0)))break;
    }
  }finally{
    for(var j=0;j<saved.length;j++)f[po+j]=saved[j];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[po+i]===v;});
  var details={pid:before.value,restored:restored};
  for(var k=0;k<rows.length;k++)details["row_"+k]=JSON.stringify(rows[k]);
  result={id:"device_census_a_v3",status:rows.length===paths.length&&restored?"pass":"fail",
    details:details};
}catch(error){result={id:"device_census_a_v3",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
