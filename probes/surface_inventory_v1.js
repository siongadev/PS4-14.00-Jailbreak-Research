// Read-only presence checks to select reachable browser subsystems on this build.
function result(id, values) {
  return { id: id, status: "pass", details: values };
}

return [
  result("dom_features", {
    font_face: typeof FontFace === "function",
    mutation_observer: typeof MutationObserver === "function",
    resize_observer: typeof ResizeObserver === "function",
    intersection_observer: typeof IntersectionObserver === "function",
    dom_parser: typeof DOMParser === "function"
  }),
  result("storage_features", {
    indexed_db: typeof indexedDB !== "undefined",
    local_storage: typeof localStorage !== "undefined",
    cache_storage: typeof caches !== "undefined",
    service_worker: typeof navigator !== "undefined" && "serviceWorker" in navigator
  }),
  result("graphics_features", {
    canvas: typeof HTMLCanvasElement === "function",
    webgl1_interface: typeof WebGLRenderingContext === "function",
    webgl2_interface: typeof WebGL2RenderingContext === "function",
    offscreen_canvas: typeof OffscreenCanvas === "function",
    create_image_bitmap: typeof createImageBitmap === "function"
  }),
  result("media_features", {
    media_source: typeof MediaSource === "function",
    audio_context: typeof AudioContext === "function",
    rtc_peer_connection: typeof RTCPeerConnection === "function",
    media_recorder: typeof MediaRecorder === "function"
  }),
  result("binary_features", {
    webassembly: typeof WebAssembly === "object",
    shared_array_buffer: typeof SharedArrayBuffer === "function",
    bigint64_array: typeof BigInt64Array === "function",
    data_view: typeof DataView === "function",
    structured_clone: typeof structuredClone === "function"
  }),
  result("messaging_features", {
    worker: typeof Worker === "function",
    shared_worker: typeof SharedWorker === "function",
    message_channel: typeof MessageChannel === "function",
    broadcast_channel: typeof BroadcastChannel === "function",
    websocket: typeof WebSocket === "function"
  })
];
