// Bounded, valid-input regression checks for WebKit bug 308046 (YARR JIT offset).
function exercise(id, expression, input, expectedMatch, expectedCapture) {
  try {
    var early = 0;
    var middle = 0;
    var late = 0;
    var firstFailure = -1;
    var lastMatch = "";
    var lastCapture = "";
    for (var iteration = 0; iteration < 600; iteration++) {
      var match = expression.exec(input);
      var correct = !!match && match[0] === expectedMatch && match[1] === expectedCapture;
      if (!correct && firstFailure < 0)
        firstFailure = iteration;
      if (correct) {
        if (iteration < 25) early++;
        if (iteration >= 275 && iteration < 300) middle++;
        if (iteration >= 575) late++;
      }
      if (iteration === 599 && match) {
        lastMatch = match[0];
        lastCapture = match[1];
      }
    }
    return {
      id: id,
      status: firstFailure < 0 ? "pass" : "fail",
      details: { early_correct: early, middle_correct: middle, late_correct: late,
                 first_failure_iteration: firstFailure,
                 last_match_length: lastMatch.length, last_capture_length: lastCapture.length }
    };
  } catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

var pair = "\uD800\uDC00";
return [
  exercise("unicode_no_trailing_control", /(.)\1/u, pair + pair, pair + pair, pair),
  exercise("unicode_trailing_literal", /(.)\1c/u, pair + pair + "c", pair + pair + "c", pair),
  exercise("unicode_two_trailing_literals", /(.)\1cd/u, pair + pair + "cd", pair + pair + "cd", pair),
  exercise("unicode_case_insensitive", /(.)\1c/iu, pair + pair + "c", pair + pair + "c", pair),
  exercise("ascii_case_insensitive_control", /(.)\1c/iu, "aac", "aac", "a"),
  exercise("ascii_plain_control", /(.)\1c/, "aac", "aac", "a")
];
