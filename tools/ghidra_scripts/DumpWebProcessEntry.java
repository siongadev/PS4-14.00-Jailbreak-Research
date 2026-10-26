// Ghidra headless post-script for the analysis-only ELF built from 14.00 RAM.
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

public class DumpWebProcessEntry extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 1) {
            throw new IllegalArgumentException("expected one output path");
        }
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(args[0]), StandardCharsets.UTF_8))) {
            out.println("Program: " + currentProgram.getName());
            out.println("Language: " + currentProgram.getLanguageID());
            out.println("Original bytes: analysis-only ELF made from live PS4 14.00 RX mapping");
            DecompInterface decompiler = new DecompInterface();
            decompiler.openProgram(currentProgram);
            try {
                for (String selector : new String[] { "0x1734730", "0x1733cd0" }) {
                    Address address = toAddr(selector);
                    Function function = currentProgram.getFunctionManager().getFunctionContaining(address);
                    out.println("\n=== " + selector + " ===");
                    if (function == null) {
                        out.println("No analyzed function at this address");
                        continue;
                    }
                    out.println("Function: " + function.getName() + " @ " +
                        function.getEntryPoint() + " body bytes " +
                        function.getBody().getNumAddresses());
                    DecompileResults result = decompiler.decompileFunction(function, 60, monitor);
                    if (result.getDecompiledFunction() == null) {
                        out.println("Decompilation unavailable: " + result.getErrorMessage());
                    } else {
                        out.println(result.getDecompiledFunction().getC());
                    }
                }
                out.println("\n=== Function entries in captured RX region ===");
                int count = 0;
                FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
                for (Function function : functions) {
                    long offset = function.getEntryPoint().getOffset();
                    if (offset >= 0x1730000L && offset < 0x1738000L) {
                        out.println(function.getEntryPoint() + " " + function.getName());
                        count++;
                    }
                }
                out.println("Function count in captured region: " + count);
            } finally {
                decompiler.dispose();
            }
        }
    }
}
