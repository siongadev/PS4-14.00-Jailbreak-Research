// Isolated compiler analogy; this is not Sony or WebKit source.
struct Wrapper {
    int kind;
    unsigned long long nativePointer;
    unsigned long long wrapped() const { return nativePointer; }
};

static inline Wrapper* dynamicCast(Wrapper* value)
{
    return value->kind == 1 ? value : nullptr;
}

extern "C" unsigned long long unguardedWrapped(Wrapper* value)
{
    return dynamicCast(value)->wrapped();
}
