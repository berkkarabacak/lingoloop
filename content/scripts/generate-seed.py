import json
from pathlib import Path

ITEMS = {
    "beginner": [
        ("hows-it-going", "how's it going", "A friendly way to ask someone how they are.", "How's it going? You look great today.", "greeting"),
        ("on-my-way", "on my way", "Leaving now to go to a particular place.", "I'm on my way to the office now.", "expression"),
        ("hungry", "hungry", "Feeling that you want or need to eat.", "I'm hungry, so let's make some lunch.", "adjective"),
        ("borrow", "borrow", "To take and use something that you must return later.", "Can I borrow your charger for an hour?", "verb"),
        ("a-little-bit", "a little bit", "A small amount or degree of something.", "I'm a little bit tired this morning.", "expression"),
        ("be-late", "be late", "To arrive after the expected time.", "Please call me if you're going to be late.", "expression"),
        ("wait-a-minute", "wait a minute", "To wait for a short time.", "Wait a minute, I have an idea.", "expression"),
        ("busy", "busy", "Having a lot of work or activities to do.", "The café is always busy on Saturdays.", "adjective"),
    ],
    "intermediate": [
        ("figure-out", "figure out", "To understand or solve something after thinking about it.", "We figured out why the video would not load.", "phrasal verb"),
        ("give-up", "give up", "To stop trying because something seems too difficult.", "I almost gave up, but then I found the answer.", "phrasal verb"),
        ("run-out-of", "run out of", "To use all of something so none is left.", "We ran out of milk this morning.", "phrasal verb"),
        ("catch-up", "catch up", "To share recent news with someone you know.", "Let's catch up over coffee next week.", "phrasal verb"),
        ("to-be-honest", "to be honest", "Used before saying what you really think.", "To be honest, I expected the test to be harder.", "expression"),
        ("end-up", "end up", "To finally be in a situation you did not plan.", "We got lost and ended up by the river.", "phrasal verb"),
        ("look-forward-to", "look forward to", "To feel pleased and excited about a future event.", "I look forward to hearing from you.", "expression"),
        ("worth-it", "worth it", "Useful or enjoyable enough to justify the effort or cost.", "The walk is long, but the view is worth it.", "expression"),
    ],
    "advanced": [
        ("a-blessing-in-disguise", "a blessing in disguise", "Something that seems bad at first but produces a good result.", "Losing that job was a blessing in disguise for her.", "idiom"),
        ("nuanced", "nuanced", "Showing small but important differences in meaning or feeling.", "The article gives a nuanced view of urban life.", "adjective"),
        ("cut-corners", "cut corners", "To save time or money by doing something less carefully.", "The team cut corners and the app failed.", "idiom"),
        ("on-the-fence", "on the fence", "Unable to decide between two choices.", "I'm on the fence about moving abroad.", "idiom"),
        ("to-no-avail", "to no avail", "Without success or a useful result.", "We tried to fix the connection, to no avail.", "expression"),
        ("hit-the-ground-running", "hit the ground running", "To begin something with great energy and effectiveness.", "Our new developer hit the ground running.", "idiom"),
        ("ubiquitous", "ubiquitous", "Seeming to be everywhere at the same time.", "Smartphones are ubiquitous in modern life.", "adjective"),
        ("the-elephant-in-the-room", "the elephant in the room", "An obvious problem that people avoid discussing.", "The budget is the elephant in the room.", "idiom"),
    ],
}
FORMS = {
    "figure out": ["figure out", "figured out", "figuring out", "figures out"],
    "give up": ["give up", "gave up", "giving up", "gives up", "given up"],
    "run out of": ["run out of", "ran out of", "running out of", "runs out of"],
    "catch up": ["catch up", "caught up", "catching up", "catches up"],
    "end up": ["end up", "ended up", "ending up", "ends up"],
    "borrow": ["borrow", "borrowed", "borrowing", "borrows"],
    "be late": ["be late", "is late", "are late", "was late", "were late", "going to be late"],
    "hungry": ["hungry", "hungrier", "hungriest"],
    "busy": ["busy", "busier", "busiest"],
    "cut corners": ["cut corners", "cutting corners", "cuts corners"],
}
result = []
for level, items in ITEMS.items():
    for index, (slug, word, definition, example, pos) in enumerate(items, 1):
        forms = FORMS.get(word, [word])
        if ", " in example:
            first, second = example.split(", ", 1)
            first += ","
        else:
            words = example.split()
            cut = max(2, len(words) // 2)
            first, second = " ".join(words[:cut]), " ".join(words[cut:])
        result.append({
            "slug": slug,
            "headword": word,
            "forms": forms,
            "partOfSpeech": pos,
            "ipa": None,
            "definition": definition,
            "example": example,
            "level": level,
            "translations": {},
            "status": "published",
            "sortOrder": index,
            "video": {
                "url": f"/media/clips/{slug}.mp4",
                "poster": f"/media/posters/{slug}.jpg",
                "durationMs": 8000,
                "subtitles": [
                    {"startMs": 400, "endMs": 3500, "text": first},
                    {"startMs": 3500, "endMs": 7600, "text": example},
                ],
                "sourceType": "placeholder",
                "license": "Generated-placeholder",
                "attribution": "LingoLoop generated study card, not real-life footage",
                "sourceUrl": None,
            },
        })
output = Path(__file__).resolve().parents[1] / "seed.json"
output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {len(result)} items to {output}")
