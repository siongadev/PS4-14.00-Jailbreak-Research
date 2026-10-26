// Read-only transport and isolation capability report for this page.
return [{id:"thread_secure_context_v1",status:"pass",
  details:{secure_context:window.isSecureContext===true,
    cross_origin_isolated:window.crossOriginIsolated===true,
    shared_array_buffer_exposed:
      typeof SharedArrayBuffer==="function",
    protocol:window.location.protocol.slice(0,12),
    local_host:window.location.hostname==="localhost" ||
      window.location.hostname==="127.0.0.1"}}];
