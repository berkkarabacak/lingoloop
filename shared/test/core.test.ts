import test from "node:test";
import assert from "node:assert/strict";
import { activeCue, formatCueText, parseCueText, splitHighlight } from "../src/index.ts";

test("highlight is case-insensitive, longest-first, and word-boundary safe", () => {
  const parts = splitHighlight("I almost gave up, not give up. Busybody is busy.", ["give up", "gave up", "busy"]);
  assert.equal(parts.filter((part) => part.hit).map((part) => part.text).join("|"), "gave up|give up|busy");
  assert(!splitHighlight("busybody", ["busy"]).some((part) => part.hit));
});

test("active cue uses start-inclusive and end-exclusive boundaries", () => {
  const cues = [{ startMs: 1000, endMs: 2000, text: "hello" }];
  assert.equal(activeCue(cues, 999), null);
  assert.equal(activeCue(cues, 1000)?.text, "hello");
  assert.equal(activeCue(cues, 2000), null);
});

test("cue text round-trips", () => {
  const cues = parseCueText("00:01.200 --> 00:03.000 | Hello world");
  assert.deepEqual(cues, [{ startMs: 1200, endMs: 3000, text: "Hello world" }]);
  assert.deepEqual(parseCueText(formatCueText(cues)), cues);
});
