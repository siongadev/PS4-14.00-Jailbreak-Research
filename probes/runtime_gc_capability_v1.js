return [{ id: "gc_capability", status: "pass", details: {
  gc: typeof window.gc,
  internals: typeof window.internals,
  gc_controller: typeof window.GCController,
  weak_ref: typeof window.WeakRef,
  finalization_registry: typeof window.FinalizationRegistry
} }];
