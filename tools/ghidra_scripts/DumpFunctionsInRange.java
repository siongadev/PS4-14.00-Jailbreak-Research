// Decompile a bounded range of functions in an analysis-only live-image ELF.
// @category FW14

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

public class DumpFunctionsInRange extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 4) {
            throw new IllegalArgumentException(
                "expected output path, start, end, maximum body bytes");
        }
        Address start = toAddr(args[1]);
        Address end = toAddr(args[2]);
        long maximum = Long.parseLong(args[3]);
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(args[0]), StandardCharsets.UTF_8))) {
            DecompInterface decompiler = new DecompInterface();
            decompiler.openProgram(currentProgram);
            try {
                FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
                while (functions.hasNext()) {
                    Function function = functions.next();
                    Address entry = function.getEntryPoint();
                    if (entry.compareTo(start) < 0 || entry.compareTo(end) >= 0 ||
                        function.getBody().getNumAddresses() > maximum) {
                        continue;
                    }
                    out.println("\n=== " + entry + " body=" +
                        function.getBody().getNumAddresses() + " ===");
                    DecompileResults result = decompiler.decompileFunction(function, 60, monitor);
                    if (result.getDecompiledFunction() == null) {
                        out.println("Unavailable: " + result.getErrorMessage());
                    } else {
                        out.println(result.getDecompiledFunction().getC());
                    }
                }
            } finally {
                decompiler.dispose();
            }
        }
    }
}
