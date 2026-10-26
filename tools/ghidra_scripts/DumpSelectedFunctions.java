// Ghidra headless post-script for focused analysis of the live 14.00 image.
// @category FW14

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

public class DumpSelectedFunctions extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 2) {
            throw new IllegalArgumentException("expected output path and addresses");
        }
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(
                new FileOutputStream(args[0]), StandardCharsets.UTF_8))) {
            out.println("Analysis-only ELF built from 14.00 live RX bytes");
            DecompInterface decompiler = new DecompInterface();
            decompiler.openProgram(currentProgram);
            try {
                for (int i = 1; i < args.length; i++) {
                    Address address = toAddr(args[i]);
                    Function function = currentProgram.getFunctionManager().getFunctionContaining(address);
                    out.println("\n=== " + args[i] + " ===");
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
            } finally {
                decompiler.dispose();
            }
        }
    }
}
