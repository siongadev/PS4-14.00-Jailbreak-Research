// Deterministic expansion of WebKit bug 308046's Unicode backreference case.
// The source specifies every input; a mismatch is a logical oracle, not a crash oracle.
var astral = ["\uD800\uDC00", "\uD83D\uDCA9", "\uDBFF\uDFFF"];
var characters = ["a"].concat(astral);
var prefixes = ["", "x", "xy"];
var suffixes = ["", "c", "cd", "cde"];
var flags = ["u", "iu"];
var total = 0;
var mismatches = 0;
var warmedMismatches = 0;
var firstMismatch = "";
var started = Date.now();

for (var characterIndex = 0; characterIndex < characters.length; characterIndex++) {
  for (var prefixIndex = 0; prefixIndex < prefixes.length; prefixIndex++) {
    for (var suffixIndex = 0; suffixIndex < suffixes.length; suffixIndex++) {
      for (var flagIndex = 0; flagIndex < flags.length; flagIndex++) {
        var character = characters[characterIndex];
        var prefix = prefixes[prefixIndex];
        var suffix = suffixes[suffixIndex];
        var expression = new RegExp("^" + prefix + "(.)\\1" + suffix + "$", flags[flagIndex]);
        var input = prefix + character + character + suffix;
        var expected = input;
        var bad = false;
        var badAfterWarmup = false;
        for (var iteration = 0; iteration < 600; iteration++) {
          var match = expression.exec(input);
          if (!match || match[0] !== expected || match[1] !== character) {
            bad = true;
            if (iteration >= 500)
              badAfterWarmup = true;
          }
        }
        total++;
        if (bad) {
          mismatches++;
          if (!firstMismatch)
            firstMismatch = "char=" + characterIndex + ",prefix=" + prefixIndex +
              ",suffix=" + suffixIndex + ",flags=" + flags[flagIndex];
        }
        if (badAfterWarmup)
          warmedMismatches++;
      }
    }
  }
}

return [{
  id: "unicode_offset_matrix",
  status: mismatches === 0 ? "pass" : "fail",
  details: {
    cases: total,
    iterations_per_case: 600,
    mismatch_cases: mismatches,
    warmed_mismatch_cases: warmedMismatches,
    first_mismatch: firstMismatch,
    elapsed_ms: Date.now() - started
  }
}];
