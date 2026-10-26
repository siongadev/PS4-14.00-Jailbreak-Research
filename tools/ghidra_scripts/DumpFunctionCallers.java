// List static references to selected functions in a synthetic live image.
// @category FW14

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

public class DumpFunctionCallers extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 2) throw new IllegalArgumentException("expected output path and addresses");
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(args[0]), StandardCharsets.UTF_8))) {
            out.println("Analysis-only ELF built from 14.00 live RX bytes");
            for (int i = 1; i < args.length; i++) {
                Address address = toAddr(args[i]);
                Function target = currentProgram.getFunctionManager().getFunctionAt(address);
                Reference[] refs = getReferencesTo(address);
                out.println("\n=== " + address + " " +
                    (target == null ? "no_function" : target.getName()) +
                    " references=" + refs.length + " ===");
                for (Reference ref : refs) {
                    Function caller = currentProgram.getFunctionManager()
                        .getFunctionContaining(ref.getFromAddress());
                    out.println(ref.getFromAddress() + " " + ref.getReferenceType() +
                        " caller=" + (caller == null ? "none" : caller.getEntryPoint()));
                }
            }
        }
    }
}
