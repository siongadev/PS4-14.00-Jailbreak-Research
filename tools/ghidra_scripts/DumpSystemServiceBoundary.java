// Inspect string references in the synthetic 14.00 system-service RX image.
// @category FW14

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;

public class DumpSystemServiceBoundary extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 1) throw new IllegalArgumentException("expected output path");
        String[][] targets = {
            {"nonsecure_webcore_check", "0x8371495c8"},
            {"system_service_impl_source", "0x837149a6d"},
            {"launch_app", "0x837149aba"},
            {"webapp_socket", "0x83714916a"},
            {"lnc_launch", "0x837149f5f"},
            {"lnc_load_exec", "0x83714a074"}
        };
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(args[0]), StandardCharsets.UTF_8))) {
            out.println("Analysis-only ELF from live PS4 14.00 libSceSystemService RX bytes");
            DecompInterface decompiler = new DecompInterface();
            decompiler.openProgram(currentProgram);
            Set<Address> functions = new LinkedHashSet<>();
            try {
                for (String[] target : targets) {
                    Address address = toAddr(target[1]);
                    out.println("\n=== " + target[0] + " @ " + address + " ===");
                    Reference[] refs = getReferencesTo(address);
                    out.println("references: " + refs.length);
                    for (Reference ref : refs) {
                        Function function = currentProgram.getFunctionManager()
                            .getFunctionContaining(ref.getFromAddress());
                        out.println(ref.getFromAddress() + " " + ref.getReferenceType() +
                            " function=" + (function == null ? "none" :
                            function.getEntryPoint().toString()));
                        if (function != null) functions.add(function.getEntryPoint());
                    }
                }
                int count = 0;
                for (Address entry : functions) {
                    if (count++ >= 12) break;
                    Function function = currentProgram.getFunctionManager().getFunctionAt(entry);
                    if (function == null) continue;
                    out.println("\n=== FUNCTION " + entry + " " + function.getName() + " ===");
                    DecompileResults result = decompiler.decompileFunction(function, 90, monitor);
                    out.println(result.getDecompiledFunction() == null ?
                        "decompilation unavailable: " + result.getErrorMessage() :
                        result.getDecompiledFunction().getC());
                }
            } finally {
                decompiler.dispose();
            }
        }
    }
}
