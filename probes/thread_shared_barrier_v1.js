// Bounded, JavaScript-only page/worker Atomics.wait/notify control.
return new Promise(function (resolve) {
  var hasShared=typeof SharedArrayBuffer==="function";
  var hasAtomics=typeof Atomics==="object" &&
    typeof Atomics.wait==="function" &&
    typeof Atomics.notify==="function";
  var worker=null,url=null,timer=null,finished=false,notified=0;
  var shared=null,words=null,readyAt=0,doneAt=0;
  function finish(status,details) {
    if (finished) return;
    finished=true;
    if (timer!==null) clearTimeout(timer);
    if (worker) worker.terminate();
    if (url) URL.revokeObjectURL(url);
    resolve([{id:"thread_shared_barrier_v1",status:status,
      details:details}]);
  }
  if (!hasShared || !hasAtomics || typeof Worker!=="function" ||
      typeof Blob!=="function") {
    finish("unsupported",{cross_origin_isolated:
      window.crossOriginIsolated===true,
      shared_array_buffer_exposed:hasShared,
      atomics_wait_exposed:hasAtomics});
    return;
  }
  try {
    shared=new SharedArrayBuffer(8);
    words=new Int32Array(shared);
    if (shared.byteLength!==8 || words.length!==2)
      throw new Error("shared_size_invalid");
    var source=[
      "self.onmessage=function(event){",
      "  try {",
      "    var words=new Int32Array(event.data.shared);",
      "    Atomics.store(words,1,1);",
      "    self.postMessage({phase:'ready',stamp:Date.now()});",
      "    var outcome=Atomics.wait(words,0,0,1500);",
      "    self.postMessage({phase:'done',outcome:outcome,",
      "      word:Atomics.load(words,0),stamp:Date.now()});",
      "  } catch(error) {",
      "    self.postMessage({phase:'error',message:String(error).slice(0,120)});",
      "  }",
      "};"
    ].join("\n");
    url=URL.createObjectURL(new Blob([source],
      {type:"text/javascript"}));
    worker=new Worker(url);
    timer=setTimeout(function () {
      finish("error",{phase:"timeout",ready_seen:readyAt>0,
        final_word:words ? Atomics.load(words,0):null});
    },3000);
    worker.onerror=function (event) {
      finish("error",{phase:"worker",error:
        String(event.message||"worker_error").slice(0,120)});
    };
    worker.onmessage=function (event) {
      if (finished) return;
      var data=event.data||{};
      if (data.phase==="error") {
        finish("error",{phase:"worker",error:data.message||"unknown"});
        return;
      }
      if (data.phase==="ready" && !readyAt) {
        readyAt=Date.now();
        setTimeout(function () {
          if (finished) return;
          Atomics.store(words,0,1);
          notified=Atomics.notify(words,0,1);
        },50);
        return;
      }
      if (data.phase==="done" && readyAt) {
        doneAt=Date.now();
        var finalWord=Atomics.load(words,0);
        var workerReady=Atomics.load(words,1);
        finish(data.outcome==="ok" && notified===1 &&
          data.word===1 && finalWord===1 && workerReady===1 ?
          "pass":"fail",
          {cross_origin_isolated:window.crossOriginIsolated===true,
            wait_outcome:String(data.outcome).slice(0,40),
            notify_count:notified,worker_word:data.word,
            final_word:finalWord,worker_ready:workerReady,
            elapsed_ms:doneAt-readyAt});
        return;
      }
      finish("error",{phase:"message",error:"unexpected_reply"});
    };
    worker.postMessage({shared:shared});
  } catch (error) {
    finish("error",{phase:"setup",error:String(error).slice(0,120)});
  }
});
