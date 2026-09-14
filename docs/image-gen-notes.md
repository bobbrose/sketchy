# Soundscapes Image Generation Recommendations

## Objective

Improve generated artwork for music artists, songs, and lyrics while avoiding:

- People, faces, bodies, silhouettes, and crowds
- Generic concert-poster compositions
- Literal representations of every prompt detail
- Common “AI art” traits such as neon gradients, floating symbols, excessive detail, and glossy 3D rendering

The central product principle is:

> Interpret the music. Do not illustrate the musician.

## Current Problem

The existing prompt-generation step produces overly literal descriptions containing many concrete objects:

- Performer
- Instrument
- Stage
- Crowd
- Musical notes
- Album-inspired graphics
- Decorative environmental elements

The image model attempts to include every noun, producing crowded and artificial-looking compositions.

This is primarily a prompt-architecture problem, although upgrading the image model should also help.

## Recommended Architecture

Replace the current pipeline:

```text
Artist, song, or lyrics
    → descriptive image prompt
    → image generation
```

With:

```text
Artist, song, or lyrics
    → musical and emotional interpretation
    → structured art direction
    → final image prompt
    → image generation
```

The intermediate LLM should act as an art director, not as an image describer.

## Model Recommendation

Use the strongest currently supported OpenAI image model for production-quality final images.

Keep the image-model identifier configurable so different models can be evaluated without code changes.

Suggested configuration:

```text
IMAGE_MODEL_FINAL=<highest-quality-current-model>
IMAGE_MODEL_PREVIEW=<lower-cost-faster-model>
```

Use the high-quality model for saved or final images. Consider a faster model for previews if latency and cost become important.

Do not hard-code a model name throughout the application.

## Structured Art-Direction Schema

The interpretation step should return structured data rather than an unbounded prose prompt.

```ts
type ArtDirection = {
  subject: string;
  emotionalCharacter: string[];
  visualMetaphor: string;
  palette: string[];
  materials: string[];
  composition: string;
  artisticStrategy:
    | "abstract"
    | "painterly"
    | "collage"
    | "cinematic"
    | "minimal";
  visualMotifs: string[];
  avoid: string[];
};
```

Example:

```json
{
  "subject": "Progressive bluegrass improvisation and mandolin-driven acoustic music",
  "emotionalCharacter": [
    "joyful",
    "restless",
    "warm",
    "virtuosic",
    "communal",
    "spontaneous"
  ],
  "visualMetaphor": "A summer landscape transformed by vibration and rhythm",
  "palette": [
    "sun-faded amber",
    "tobacco brown",
    "indigo twilight",
    "dusty green"
  ],
  "materials": [
    "weathered wood",
    "rough paper",
    "dry grass",
    "scratched paint",
    "instrument varnish"
  ],
  "composition": "Loose asymmetrical composition with layered forms and substantial negative space",
  "artisticStrategy": "collage",
  "visualMotifs": [
    "rhythmic contours",
    "overlapping organic shapes",
    "subtle visual vibration"
  ],
  "avoid": [
    "people",
    "performers",
    "silhouettes",
    "faces",
    "crowds",
    "stages",
    "musical notes",
    "typography",
    "album-cover imitation",
    "neon gradients"
  ]
}
```

## Interpretation Prompt

Use an LLM prompt similar to the following:

```text
You are the art director for Soundscapes, a product that translates
music into original visual artwork.

Analyze the supplied artist, song, or lyrics and produce a structured
art direction. Interpret the emotional and musical character rather
than illustrating the performer.

Choose one strong visual metaphor and one coherent artistic strategy.
Translate the music through color, materials, light, geometry,
landscape, objects, texture, atmosphere, and composition.

Avoid literal combinations of objects mentioned in the source.
A lyric mentioning fire, rain, a heart, and a road should not
automatically produce all four objects.

Never request people, portraits, faces, bodies, silhouettes, crowds,
concert stages, artist names, song titles, logos, recognizable
branding, or reproductions of album artwork.

Return valid JSON matching the supplied ArtDirection schema.
```

## Global Soundscapes Art Direction

All images should share a recognizable visual grammar:

- Contemporary editorial artwork
- Tactile, analog, and imperfect
- Painted textures, collage, printmaking, or subtle photographic texture
- Intentional and restrained palettes
- Strong composition
- Meaningful negative space
- Poetic rather than literal imagery
- Sophisticated rather than cartoonish
- No embedded text

The goal is for a gallery of unrelated songs and artists to still feel recognizably like one product.

## Final Image Prompt Template

```text
Create an evocative visual interpretation of the music, not an
illustration of the artist.

Create sophisticated contemporary editorial artwork with a tactile,
analog, human-made quality. Use layered printmaking, painted textures,
collage, paper grain, and subtle photographic texture where appropriate.
Use strong composition, deliberate negative space, and a restrained,
intentional palette.

The result should feel like artwork commissioned by an excellent
independent music magazine or record label.

Interpretation:
{visual_metaphor}

Emotional character:
{emotional_character}

Palette:
{palette}

Materials and texture:
{materials}

Composition:
{composition}

Visual motifs:
{visual_motifs}

Do not depict musicians, people, faces, bodies, silhouettes, mannequins,
statues, performers, audiences, or crowds. Do not include text, artist
names, song titles, lyrics, logos, recognizable branding, or copied
album artwork. Avoid musical notes, treble clefs, microphones, and
generic concert stages.

Avoid gratuitous neon glow, fantasy lighting, hyper-saturation,
perfectly centered hero objects, excessive detail, floating symbols,
glossy 3D rendering, and generic concert-poster imagery.
```

Also test a shorter version because concise prompts may produce more coherent results:

```text
Create sophisticated editorial artwork interpreting {visual_metaphor}.
Use {palette}, {materials}, and {composition}. The mood is
{emotional_character}. Make it tactile, restrained, imperfect, and
poetic. No people, human figures, text, logos, album artwork, musical
notes, concert stages, neon gradients, centered hero objects, or
glossy 3D rendering.
```

## Artistic Strategies

The interpretation step should choose an artistic strategy appropriate to the music.

| Musical character | Suggested visual approach |
| --- | --- |
| Structural, dramatic classical music | Architecture, geometry, storm, tension |
| Acoustic or bluegrass music | Organic motion, wood, landscape, tactile materials |
| Punk | Torn collage, photocopy texture, urban fragments |
| Intimate folk | Paper, memory, domestic objects, rural light |
| Expansive singer-songwriter music | Landscape, atmosphere, air, natural scale |
| Funk or glamorous pop | Luxurious abstraction, electricity, velvet, sensual geometry |
| Alienated alternative music | Empty architecture, negative space, digital artifacts |
| Sparse jazz | Smoke, restrained abstraction, isolated color fields |
| Psychedelic music | Botanical forms, repetition, organic geometry |
| Tense nocturnal pop | Reflections, footsteps, darkness, sharp geometry |

These are starting points rather than fixed artist-to-style mappings.

## Lyrics Pipeline

Do not pass complete lyrics directly to the image model.

Extract:

- Primary emotion
- Emotional progression
- Narrative perspective
- Setting
- Motion
- Era or cultural atmosphere
- Recurring imagery
- Color associations
- Materials and texture
- Abstraction level
- One visual metaphor

The interpretation stage should deliberately discard literal imagery that would create a cliché.

Example transformation:

```text
Literal source concepts:
heart + fire + rain + road

Art direction:
A nearly empty highway at blue hour viewed through
rain-distorted glass. Distant sodium lights dissolve into amber
pools across broad dry-brush textures and scratched charcoal.
The image feels melancholy but continues moving forward.
```

## User-Facing Modes

Offer approximately five curated interpretation modes:

- Abstract
- Painterly
- Collage
- Cinematic
- Minimal

Avoid exposing dozens of generic style presets. Each mode should remain within the global Soundscapes visual identity.

The mode should influence:

- Composition
- Abstraction level
- Texture
- Material
- Lighting
- Amount of detail

It should not merely append a style adjective to the final prompt.

## Quality Controls

Before sending a generated prompt to the image model, validate it for:

- References to people or performers
- Artist names or song-title text requested inside the image
- More than one competing visual metaphor
- Excessive lists of concrete objects
- References to album-cover recreation
- Generic concert imagery
- Floating music symbols
- Centered hero compositions
- Neon, glowing, fantasy, or glossy 3D language
- Excessive prompt length

If validation fails, regenerate the art direction rather than silently appending more negative instructions.

## Evaluation Plan

Create a fixed evaluation set representing varied music:

- Classical
- Bluegrass
- Punk
- Folk
- Pop
- Funk
- Jazz
- Psychedelic rock
- Electronic or alternative
- Narrative lyrics
- Abstract lyrics

For each input, compare:

1. Current prompt pipeline
2. Structured art-direction pipeline with the current image model
3. Structured pipeline with the upgraded image model
4. Long final prompt
5. Compressed final prompt

Evaluate each result on:

- Visual quality
- Absence of people
- Composition
- Coherence
- Originality
- Emotional relevance
- Absence of generic AI traits
- Consistency with the Soundscapes identity

Store the following for each generation:

```ts
type GenerationRecord = {
  sourceInput: string;
  sourceType: "artist" | "song" | "lyrics";
  interpretationMode: string;
  artDirection: ArtDirection;
  finalPrompt: string;
  interpretationModel: string;
  imageModel: string;
  createdAt: string;
  userRating?: number;
  userFeedback?: string;
};
```

## Recommended Implementation Order

1. Make the image-model identifier configurable.
2. Define the `ArtDirection` schema.
3. Replace freeform prompt generation with structured interpretation.
4. Add final prompt assembly from the structured fields.
5. Add validation and one controlled regeneration attempt.
6. Implement the five interpretation modes.
7. Create a fixed evaluation dataset.
8. Compare current and revised pipelines before changing the default.
9. Record prompts, model versions, results, ratings, and failures.
10. Tune the global Soundscapes visual direction based on repeated testing.

## Acceptance Criteria

The first version is successful when:

- Generated images contain no people in at least 95% of the evaluation set.
- Images no longer default to concert stages or poster compositions.
- Each image has one coherent visual metaphor.
- Outputs across different genres feel varied but belong to the same product.
- Prompt and model versions are recorded for reproducibility.
- A user can regenerate using a different interpretation mode.
- Internal reviewers consistently prefer the revised pipeline over the current one.

## Product Principle

The LLM’s job is not:

> Write a detailed image prompt about this musician.

Its job is:

> Translate the musical experience into a coherent art direction.

The image model should then execute that direction.

## Discussion

Reviewed against this project's actual scale (a single-file hobby app, no
accounts, one maintainer) and against real output already produced by the
current pipeline, not just in the abstract.

**Keep - genuinely good, low-risk, worth doing:**

- The core architecture shift (free-prose prompt → structured art-direction
  JSON → template-assembled final prompt) is the one high-value change here.
  It's not an extra API call - the existing art-direction step already makes
  one GPT call; this just makes its output structured instead of prose, via
  OpenAI structured outputs. Everything downstream (validation, consistent
  template assembly) gets easier once the shape is fixed.
- The named anti-cliché list (neon gradients, floating music notes, generic
  concert-poster composition, glossy 3D, hyper-saturation) targets real,
  nameable AI-art tells and is easy to act on directly.
- "Interpret the music, don't illustrate the musician" is a sharp, useful
  north star for the prompt-writing step.

**Disagree, with reasoning:**

- **"No people, ever" fights what's already working.** Pulling actual
  generations from recent testing: a Guns N' Roses image ("shadowy
  silhouette of a wild-haired figure in a leather jacket") and a Weeknd
  image (a full silhouetted figure) are both genuinely strong results that
  lean on stylized silhouette, not literal illustration. A blanket ban on
  "people, bodies, silhouettes" would remove a device that's currently
  producing some of the best output, based on taste rather than evidence
  from this app's own gallery. Narrower rule: no literal faces / portraits /
  photographic figures; a silhouette or iconic outline is a visual metaphor,
  not a portrait of the musician.
- **"Use the strongest current model" contradicts work already shipped and
  measured.** `gpt-image-1` vs `gpt-image-2` (both at medium quality) was
  timed head-to-head in an earlier session: `gpt-image-2` was ~2.7x slower
  for no clear quality win worth the cost, landing back at the ~45-53s wait
  that prompted that whole performance pass. This doc's model
  recommendation is asserted, not tested, and doesn't mention cost at all
  (quality-tier jumps are non-trivial - roughly a 15x cost gap between low
  and high quality was measured earlier too). Any future model change gets
  the same timed-and-eyeballed comparison, not a docs-driven upgrade.
- **The evaluation plan is sized for a team, not a solo project.** 11 genres
  × 5 pipeline variants × a formal scoring rubric × a `GenerationRecord`
  persistence layer + ratings UI is a real ML eval harness. Proportionate
  version: a handful of representative prompts, old pipeline vs new
  side-by-side, eyeballed directly - no schema, no storage, no rubric.
- **Skip the 5 user-facing "modes" for this pass.** Legitimate idea, but a
  separate, real UI feature (new control, new state, new API param, new
  CSS) bundled into what's framed as an image-quality fix. Ship the
  structured-prompt change alone first and see how much of the "generic AI
  art" problem it resolves before adding a mode picker on top.
- **Validation-and-regenerate should be a free local check, not another
  model call.** The doc doesn't specify the mechanism; if it means a second
  LLM call to review the output, that's a third round-trip per generation -
  directly working against the latency effort already spent. A keyword
  check against the structured JSON fields is instant and free.
- **The final-prompt template contradicts its own advice.** It correctly
  suggests testing a shorter prompt for coherence, then makes the long,
  triple-repeated-avoid-list version the primary one anyway. Start with the
  short version as the only version.

## Decisions

Scoped to what's actually being built this pass, inside the existing
`server/imageGeneration.js` module (see its own header comment - it already
exists specifically to isolate this concern from `server.js`'s HTTP/storage/
rate-limiting responsibilities, so nothing new needs to be created for
that separation):

1. Replace `generateArtDirectedPrompt`'s free-text completion with a
   structured-output call returning a trimmed schema: `visualMetaphor`,
   `emotionalCharacter`, `palette`, `materials`, `composition`, `avoid`.
   Dropping `artisticStrategy` and `visualMotifs` from the original schema
   for v1 - not because they're bad, but to keep the first version's schema
   surface small while it's unproven.
2. Build the final image prompt from those fields in code (string
   assembly, no LLM call), using the **short** template style from this
   doc, not the long triple-repeated one.
3. Default `avoid` guidance to faces/portraits/literal figures, not
   people/silhouettes/bodies wholesale - keeps the silhouette device that's
   already producing good results.
4. Add a cheap local keyword check against the structured JSON before
   building the final prompt; on failure, one regeneration attempt reusing
   the existing safety-fallback retry pattern already in this file, rather
   than new infrastructure.
5. Leave the image model, quality tier, and moderation setting exactly as
   they are (`gpt-image-1`, medium, low) - not touched without re-running
   the same timed comparison used for the earlier perf work.
6. Validate with a manual side-by-side of ~5 prompts (old vs. new pipeline),
   eyeballed directly - no scoring rubric, no `GenerationRecord` storage.
7. Explicitly **not** doing this pass: interpretation modes,
   `GenerationRecord` persistence, user ratings, `IMAGE_MODEL_FINAL` /
   `IMAGE_MODEL_PREVIEW` config split.

Net effect: one function rewrite in `imageGeneration.js` (the prompt-writing
step) plus a small template-assembly helper - not a 10-step rollout.

## Comparison Results

Implemented per the Decisions above, then A/B'd old vs. new pipeline on 5
real gallery prompts (Beethoven, The Clash, Nanci Griffith, Sam Bush, Taylor
Swift) via a one-off script (not committed - see the workflow discussion
that produced this), each pair generated with everything else identical
(same image model/quality/moderation).

**4 of 5 were clear wins for the new pipeline**, and not just on taste - the
old pipeline was producing real, nameable defects:

- Nanci Griffith: old fabricated a portrait of her face with her actual
  name printed as a caption. Worst-case failure mode - a fake likeness
  falsely attributed by name, not just a clutter problem.
- The Clash: old embedded a fake "THE CLASH" logo as image text.
- Taylor Swift: old embedded a fake "Lover" album-title as image text.
- Beethoven: old produced a literal face portrait plus a crowd of
  conductor silhouettes and scattered musical notes - the "crowded,
  literal" failure mode described at the top of this document, almost
  exactly.

**One honest exception: Sam Bush.** The old result was genuinely good (a
mandolin silhouette, cowboy boots, starry sky) - already one of the better
outputs in circulation. The new one is well-crafted but drifted into
generic abstract wave art, losing the specific charm that made the old one
work. Real signal that "avoid literal objects" can overcorrect into
decorative abstraction when the interpretation step doesn't land on a
concrete-enough metaphor. Not a blocker to shipping, but worth watching as
this sees more real use - if it recurs, the fix is likely nudging the
interpretation prompt to require the visual metaphor stay recognizable, not
just decorative.

None of the 5 new-pipeline runs tripped the local keyword-check
regeneration - all passed clean on the first attempt in this sample.

**Decision: ship the new pipeline.** The defects it fixes (fabricated
portraits attributed by name, fake embedded text) are more serious than the
one regression it introduced (occasional generic abstraction), and that
regression has a clear, cheap lever to pull later if it keeps happening.

### Second batch: 5 more real prompts

Ran a second batch against 5 more prompts already in the live gallery
(Queen, Grateful Dead, Kendrick Lamar, Billy Jean, Daft Punk) - chosen for
genre spread the first batch didn't cover, plus Billy Jean specifically
because it's the exact prompt that tripped the safety-rejection fallback
chain the first time this app was debugged. Full images for both batches:
see the published comparison referenced from this session, or re-run the
same one-off script against `server/imageGeneration.js`.

**3 more clear wins, at least as serious as the first batch:**

- Kendrick Lamar: the single worst result across both batches. Old
  rendered a realistic-leaning portrait of an actual living person *and*
  garbled, misspelled embedded lyrics ("IF YOU HEAR THEW YOU BELIEVE").
  New: a moody skyline silhouette, no likeness, no broken text.
- Grateful Dead: old redrew the band's actual trademarked "Steal Your
  Face" skull-and-lightning-bolt logo closely enough to be a real
  reproduction of protected artwork, not just an homage - a real IP
  exposure the notes doc hadn't specifically anticipated. New keeps the
  psychedelic spirit without reproducing anything.
- Daft Punk: old embedded fake glowing logo text and depicted the duo's
  helmeted personas directly. New's light-trail cityscape keeps the
  futurism/motion that's the actual point of their aesthetic, with neither
  problem.

**A second instance of the Sam Bush pattern: Queen.** Old was
characterful and unmistakably Queen (throne, crown, a Freddie Mercury
silhouette - albeit still with embedded "QUEEN" text). New produced a
well-made gilded floral abstract piece that reads as "regal" in mood only,
with nothing tying it back to the band. This is no longer a single
exception - it's now 2 of 10 sampled prompts (both centered on a strong,
recognizable existing visual identity: a mandolin-and-boots stage, a
crown-and-throne). **Upgrading this from "watch for it" to a real, scoped
follow-up**: nudge the interpretation prompt to require the visual
metaphor stay legible/recognizable, not purely decorative, particularly
when the subject already has strong existing iconography to draw on.

**One draw: Billy Jean.** Neither pipeline needed the safety-fallback this
time (unlike when this same prompt triggered it during earlier debugging).
Old already leans on silhouette and props (fedora, glove) rather than a
face and is arguably more charismatic; new's noir alley is safe but
generic. Both acceptable - no action needed here specifically.

**Running total across 10 prompts: 7 clear wins, 2 mixed (abstraction
drift), 1 draw.** Reaffirms the original decision to ship, and turns the
abstraction-drift risk into a concrete, scoped follow-up rather than a
hypothetical to revisit "if it recurs" - it recurred.

### Third round: fixing the abstraction-drift follow-up

Direct user feedback on the Billy Jean and Grateful Dead results from the
second batch confirmed the abstraction-drift pattern was worse than the
"watch for it" framing above suggested - not a subtle taste call, a real
miss ("nothing at all Dead related, compared to the original which has
iconography, bright colors, skeleton, and more of a dead vibe"). Root
cause: the interpretation prompt's original guidance ("translate through
color, materials, light... rather than a literal combination of objects")
was strong enough to suppress clutter but also suppressed legitimate,
recognizable content.

**Fix implemented in `server/imageGeneration.js`:**

- Added a required `iconicElements` field to `ART_DIRECTION_SCHEMA`: 2-4
  concrete, recognizable objects/symbols/props specifically tied to the
  artist, stylized rather than photographic, explicitly required to be an
  invented variation rather than a named/described real logo (closing the
  loophole the Grateful Dead case exposed - see below).
- Rewrote `INTERPRETATION_PROMPT` to require the art direction be
  "instantly recognizable as this specific artist," grounded in those
  concrete elements, rather than "not a literal illustration."
- `buildFinalPrompt` now states the iconic elements up front as "the actual
  subject of the composition," not folded into the mood/material lists
  where the image model could treat them as optional flavor text.

**Two issues found and fixed while validating this before re-running all
10:**

1. Regenerating Grateful Dead surfaced the interpretation step naming the
   band's actual trademark by its fan nickname ("a stealie... the iconic
   skull design with the lightning bolt") as an iconicElement - i.e. doing
   exactly the real-logo-reproduction thing the second batch had just
   flagged as a risk, now reintroduced through the new field. Fixed by
   explicitly instructing the schema and prompt that any logo-inspired
   element must be described as an invented variation in fresh words, never
   the real design's name or close appearance. Re-verified with two more
   Grateful Dead generations - both produced original imagery (a dancing
   bear, a reimagined skeleton) with no trademark references.
2. Running the full batch surfaced a second, unanticipated defect: The
   Clash and Sam Bush both rendered garbled, misspelled text on iconic
   elements the model chose that naturally invite lettering (jacket
   patches, festival badges - "PONK", "MUSIF", "IANBBEE"). Fixed by adding
   an explicit rule at both the interpretation-schema level and the final
   image-model-facing prompt: no iconic element may carry visible text,
   letters, or numbers; a patch/badge/sign/label must be a plain shape or
   color only. Re-verified by regenerating both - clean results with no
   text anywhere.

**Result: re-ran all 10 prompts. v2 is the best version in all 10 cases**,
including the 2 that needed the mid-review fix. Notably this also
resolves both second-round "mixed" cases from the previous section (Sam
Bush, Queen) and the "draw" case (Billy Jean) - all three now clearly beat
their v1 predecessor. Full 10-way comparison (original / v1 / v2 side by
side per prompt) published as an artifact referenced from this session;
regenerate via the same one-off script pattern against the current
`server/imageGeneration.js` if this needs re-verifying later.

**Decision: ship v2 as the default pipeline**, superseding the v1 decision
above. The abstraction-drift and embedded-text-on-props failure modes are
now both covered by explicit rules rather than being emergent behavior to
watch for.

### Fourth round: instrument-accuracy fix, incidental-crowd fix, and a real gpt-image-1 vs gpt-image-2 test

Direct feedback on the Sam Bush v2 result: he plays mandolin and fiddle,
not banjo. The interpretation prompt had no instruction to get real facts
about the artist right, so the model defaulted to "banjo" as a generic
bluegrass-genre stand-in. Fixed by adding an explicit instruction (schema
description and prompt) to use real, known facts about the specific
artist - their actual instrument, era, genre - rather than a genre
stereotype, and to choose a safer/more general element over guessing when
unsure. Verified with 3 repeated Sam Bush generations: mandolin (and once
fiddle) every time, no banjo.

While validating this fix, reviewing the full 10-prompt image-1-vs-image-2
run (below) surfaced a second, unrelated defect: Beethoven's v2 attempt (in
both gpt-image-1 and gpt-image-2 renders) included a small background
orchestra/crowd - not requested by any iconicElement, but implied by
words like "orchestra" and "live performance" elsewhere in the generated
prompt. Sam Bush's gpt-image-1 render had the same issue (a tiny jam-session
crowd). This affected both image models roughly equally, confirming it's a
prompt-level gap, not something model choice fixes. Fixed with an explicit
rule (interpretation prompt, schema, and the final image-model-facing
prompt): no crowd, audience, orchestra, or group of musicians is allowed,
even as small/distant background silhouettes - a single stylized silhouette
is only acceptable when it's itself a deliberate, named iconicElement.
Re-verified by regenerating Beethoven (both image models) and Sam Bush
(both image models, with the instrument fix too) - all four came back
clean, no figures.

**gpt-image-1 vs. gpt-image-2, on the corrected v2 prompts:** generated all
10 prompts once (text), then rendered each exact prompt through both
models (same quality/moderation settings) for a same-prompt comparison,
published in the artifact referenced from this session.

- Timing: gpt-image-2 averaged ~47s per image; gpt-image-1 stayed in the
  ~15-20s range established in the earlier perf-tuning round. Confirms the
  ~2.5-3x latency gap holds for this prompt style too, not just the old
  free-prose one.
- Quality: comparable-to-mixed, not a clear win either way. 6 of 10 were
  essentially equivalent; gpt-image-2 looked mildly better on 1 (Queen -
  more sophisticated layered composition); gpt-image-1 was more true to
  brief on 2 (Nanci Griffith, Taylor Swift) - gpt-image-2 drifted toward a
  photorealistic/staged-photo look on both despite the prompt explicitly
  requesting "tactile, painterly, imperfect," and added an unrequested
  microphone/headphones to Taylor Swift not present in any iconicElement.
- This is a real style-fit concern, not just a speed one: gpt-image-1
  reproduced the app's intended editorial/painterly identity (see
  vision.md, and the "Global Soundscapes Art Direction" section at the top
  of this doc) more reliably across the sample.

**Decision: stay on gpt-image-1.** The quality case for gpt-image-2 isn't
strong enough to justify reintroducing the latency this app's perf-tuning
round specifically fixed, and it carries a real risk of drifting away from
the app's chosen visual identity on some prompts. Revisit only if
gpt-image-2's photorealism tendency and latency both improve, or if a
future version of this app wants a more photographic (rather than
painterly) look by design.

### Fifth round: 4-column layout, 5 more real prompts

Restructured the comparison artifact from 3 columns (original/v1/v2) to 4
(original/v1/v2-gpt-image-1/v2-gpt-image-2) per prompt, so the model
comparison sits directly alongside the pipeline comparison instead of in a
separate section - direct feedback was that the separate section wasn't
noticed, and the "v2" column had been ambiguous about which image model it
used (always gpt-image-1).

Added 5 more real gallery prompts, chosen for genre/trademark coverage the
first 10 didn't have: Rolling Stones, Nirvana, Bob Marley, Purple Rain (a
song title rather than an artist name), and Dave Carter & Tracy Grammer
(the most recent real prompt in the live gallery at the time). Each ran
through all four variants - old and v1 pipelines reconstructed as frozen
functions matching their historical implementations, v2 from the current
module.

**All 5 reinforced the existing findings, with sharper examples than the
first batch:**

- Rolling Stones (original): a recognizable figure of Mick Jagger, a crowd
  of raised hands, *and* the band's actual trademarked tongue-and-lips logo
  reproduced on a guitar - three violations at once. v2 solves the logo
  problem elegantly: an abstract striped stone shape stands in for "rolling
  stone" without copying the real design.
- Nirvana (original): a full human figure beneath the band's actual
  smiley-face logo, exactly reproduced. v2 replaces it entirely with an
  original motif (a chrysanthemum) tied to their visual world instead of
  copied from it.
- Purple Rain (original): a full figure of Prince in his signature trench
  coat, his actual trademarked Love Symbol glowing above him, plus a
  background crowd - three violations in one image, on a *song title*
  prompt, not just an artist name. v2's minimal guitar-under-purple-rain
  composition is among the strongest results in the whole set.
- Dave Carter & Tracy Grammer (original): two recognizable human figures
  (posture and hair included, not just silhouette) plus their initials
  glowing in a heart - a reminder that "old" fails on real, recent, actual
  user prompts, not just cherry-picked ones.
- Bob Marley (original): an acceptable silhouette device undone by a
  literal "ONE LOVE" text badge - a reminder that even old's better results
  usually have at least one hard violation.

**gpt-image-1 vs. gpt-image-2, revisited:** the photorealism-drift finding
from the fourth round doesn't hold uniformly - on this batch, gpt-image-2
stayed just as illustrative/painterly as gpt-image-1 on 3 of 5 (Bob Marley,
Purple Rain, Dave Carter & Tracy Grammer), arguably *more* painterly than
image-1 on Purple Rain specifically. Only Rolling Stones showed the
photorealistic drift this round. Revised takeaway: the drift is real and
worth watching for, but it's prompt/subject-dependent, not a fixed property
of the model - don't treat "gpt-image-2 always goes photographic" as
settled fact. The latency gap (~2.5-3x) is the more consistent, more
decision-relevant finding across all 15 prompts now tested.

**Decision unchanged: stay on gpt-image-1 as the default.** 15 prompts
across 5 rounds is a large enough sample that this isn't provisional
anymore absent a specific reason to revisit (a gpt-image-2 speed
improvement, or a deliberate move toward a more photographic house style).