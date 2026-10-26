return [{ id: "canvas_gc_capabilities", status: "pass", details: {
  weak_ref: typeof WeakRef === "function",
  finalization_registry: typeof FinalizationRegistry === "function",
  explicit_gc: typeof window.gc === "function",
  gc_controller: !!(window.GCController && typeof window.GCController.collect === "function"),
  performance_memory: !!(window.performance && window.performance.memory)
} }];
