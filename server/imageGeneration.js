// Turning a prompt into a safe, on-brief image: the "art direction" GPT
// step, the actual image render, and the safety-rejection fallback. Kept
// separate from server.js (routing/storage/rate-limiting/admin) so the two
// concerns don't keep landing on the same lines - this file is model/prompt
// tuning territory, server.js is HTTP/storage/gallery territory.
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

// Guaranteed to run before OPENAI_API_KEY is read below regardless of
// whether server.js (which also calls dotenv.config()) has done so yet -
// ESM import evaluation order isn't something to depend on here.
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Structured art-direction step (see docs/image-gen-notes.md "Decisions",
// and the "second batch" comparison results for why iconicElements exists):
// the interpretation LLM call returns this fixed shape instead of free
// prose, which is what lets the final prompt be assembled deterministically
// in code below rather than trusting the model to self-regulate a long list
// of instructions inline in one big paragraph.
const ART_DIRECTION_SCHEMA = {
  type: "object",
  properties: {
    visualMetaphor: { type: "string", description: "One sentence: the single core visual concept for this piece." },
    iconicElements: { type: "array", items: { type: "string" }, description: "2-4 concrete, recognizable objects, symbols, instruments, props, or settings specifically associated with this artist or song - stylized and painterly, not photographic. This is what makes the piece feel like THIS artist rather than a generic mood board. Get the facts right: if you include an instrument, it must be one this specific artist/song is actually known for (their real signature instrument), not a generic stand-in for the genre - e.g. a bluegrass artist known for mandolin and fiddle should not default to banjo just because it's a common bluegrass image. If one is inspired by a real logo or emblem, describe an invented variation in fresh words (e.g. 'a skull wreathed in wildflowers') - never name the real design (no trademark/fan nicknames like 'stealie') or describe its actual appearance closely enough to reproduce it. None may carry visible words, letters, or numbers - a patch, badge, sign, or label must be described as a plain shape, color, or symbol only, never as bearing text of any kind." },
    emotionalCharacter: { type: "array", items: { type: "string" }, description: "3-5 mood words." },
    palette: { type: "array", items: { type: "string" }, description: "3-5 color descriptions." },
    materials: { type: "array", items: { type: "string" }, description: "3-5 texture/material words (e.g. 'weathered wood', 'scratched paint')." },
    composition: { type: "string", description: "One sentence describing framing and layout." },
    avoid: { type: "array", items: { type: "string" }, description: "Anything specific to this piece worth explicitly avoiding, beyond the standard defaults." },
  },
  required: ["visualMetaphor", "iconicElements", "emotionalCharacter", "palette", "materials", "composition", "avoid"],
  additionalProperties: false,
};

// Revision history worth keeping in mind if this drifts again: the first
// version of this prompt told the model to prefer "color, materials, light,
// geometry... rather than a literal combination of objects" - meant to stop
// it defaulting to a piano-plus-sheet-music-plus-crowd pileup, but it
// overshot into pure decorative abstraction (a Sam Bush piece became
// generic wavy stripes, a Queen piece became generic gilded flowers, with
// nothing tying either back to the actual artist). iconicElements above and
// the instruction below are the fix: require concrete, recognizable content,
// just not people or copied logos/text.
//
// Real silhouettes stay allowed (narrower than the original notes-doc draft
// of "no people/silhouettes/bodies at all"): a Guns N' Roses piece with "a
// shadowy silhouette of a wild-haired figure in a leather jacket" was one of
// the better results seen while planning this. Banning literal faces/
// portraits/photographic figures targets the actual problem (illustrating
// the musician) without losing a device that's already working.
const INTERPRETATION_PROMPT = (rawPrompt) => `You are the art director for Soundscapes, a product that translates music into original visual artwork.

Given this song or artist: "${rawPrompt}"

Produce a structured art direction that would be instantly recognizable as this specific artist or song, not a generic mood board that could belong to any music with a similar feel. Ground it in 2-4 concrete, recognizable visual elements genuinely tied to them - an instrument, a signature prop or outfit detail, a setting, an animal or symbol from their visual world, a stylized homage to their aesthetic - then build the palette, materials, and composition around those elements. Use what you actually know about this specific artist or song rather than a genre stereotype - get real details right (their actual instrument, era, genre, notable imagery), and if you're not confident of a specific fact, choose a safer element you do know rather than guessing.

Avoid literal faces, portraits, or photographic depictions of real people - use the concrete elements above, or a single stylized silhouette if one of your elements calls for it, instead of a person. Do not describe a stage, orchestra, live performance, or any other scene that implies a crowd or group of musicians, even as small background figures - one deliberate silhouette is fine, incidental crowds are not. Avoid any visible text, letters, numbers, or lettering anywhere in the piece, including on patches, badges, signs, labels, or record sleeves - describe those as plain shapes, colors, or symbols only, never as bearing words. Avoid artist names and song titles for the same reason. If their visual identity includes a well-known logo or emblem, invent your own fresh variation and describe only that invented version - never the real design's actual name or appearance, which would let it get reproduced downstream. Avoid generic AI-art cliches: neon gradients, floating musical notes, glossy 3D rendering, generic concert-poster composition, hyper-saturation, a lone microphone on a stand.`;

async function requestArtDirection(rawPrompt) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: INTERPRETATION_PROMPT(rawPrompt) }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "art_direction", schema: ART_DIRECTION_SCHEMA, strict: true },
    },
  });
  return JSON.parse(completion.choices[0].message.content);
}

// Cheap local check (no extra API call) for the interpretation step
// producing exactly what it was told not to - e.g. the model deciding
// "materials" should include "photorealistic face". Checked against the
// fields that describe what to *include*, not the `avoid` field, which is
// expected to mention these words.
const BANNED_WORDS = [
  'face', 'faces', 'portrait', 'photograph', 'photorealistic',
  'crowd', 'audience', 'orchestra', 'musicians', 'musical note', 'clef', 'microphone', 'neon',
];

function violatesGuidelines(artDirection) {
  const text = [
    artDirection.visualMetaphor,
    artDirection.composition,
    ...(artDirection.iconicElements || []),
    ...(artDirection.materials || []),
    ...(artDirection.palette || []),
    ...(artDirection.emotionalCharacter || []),
  ].join(' ').toLowerCase();
  return BANNED_WORDS.some((word) => text.includes(word));
}

// Short template deliberately, not the longer triple-repeated-avoid-list
// version also drafted in docs/image-gen-notes.md - concise prompts tend to
// produce more coherent results, and the interpretation step above already
// did the work of excluding the wrong content instead of the final prompt
// having to re-state it exhaustively.
// The model tends to end visualMetaphor/composition with their own
// sentence-ending period, which collides with the template text that
// follows them mid-sentence (producing "..").
const stripTrailingPeriod = (s) => s.replace(/\.\s*$/, '');

function buildFinalPrompt(artDirection) {
  const { iconicElements, emotionalCharacter, palette, materials, avoid } = artDirection;
  const visualMetaphor = stripTrailingPeriod(artDirection.visualMetaphor);
  const composition = stripTrailingPeriod(artDirection.composition);
  const avoidList = [
    'literal faces, portraits, or photographic depictions of real people',
    'any crowd, audience, orchestra, or group of musicians, including small or distant background silhouettes - a single stylized silhouette is only acceptable if it is explicitly one of the featured elements above, never incidental background filler',
    'any visible text, letters, numbers, or lettering anywhere in the image, including on patches, badges, signs, labels, or record sleeves - render those as plain shapes or colors only',
    'artist names, song titles, or logos',
    'neon gradients, glossy 3D rendering, generic concert-poster composition, floating musical notes, hyper-saturation',
    ...avoid,
  ].join('; ');

  // iconicElements stated up front and as the composition's actual subject
  // matter - not just mixed into the mood/palette list - so the image model
  // treats them as the thing to paint, not flavor text it can drop.
  return `Create sophisticated editorial artwork interpreting ${visualMetaphor}, prominently featuring ${iconicElements.join(', ')} rendered in a stylized, painterly way as the actual subject of the composition. Use ${palette.join(', ')}, ${materials.join(', ')}, and ${composition}. The mood is ${emotionalCharacter.join(', ')}. Make it tactile, restrained, imperfect, and poetic. Avoid ${avoidList}.`;
}

// Turns a raw song/artist name into a vivid, specific visual brief for the
// image model - the "art direction" step described in docs/vision.md and
// docs/image-gen-notes.md. Public signature unchanged from the previous
// free-prose version (still just rawPrompt -> final prompt string), so
// server.js needed no changes for this rewrite - the structured
// intermediate step is entirely internal to this module.
export async function generateArtDirectedPrompt(rawPrompt, isRetry = false) {
  const artDirection = await requestArtDirection(rawPrompt);

  if (violatesGuidelines(artDirection) && !isRetry) {
    console.warn('Art direction violated guidelines, regenerating once:', artDirection);
    return generateArtDirectedPrompt(rawPrompt, true);
  }

  return buildFinalPrompt(artDirection);
}

export async function generateMockImage(prompt) {
  return `https://placehold.co/600x400?text=${encodeURIComponent(prompt)}`;
}

function isSafetySystemRejection(error) {
  return typeof error?.message === 'string' && error.message.includes('safety system');
}

// Note: 'dall-e-3' has been retired; the gpt-image family is current and
// returns images as base64 (b64_json) rather than a URL.
// - "medium" quality instead of "high": OpenAI's own docs put roughly a 15x
//   gap in tokens (and latency/cost) between low and high at the same
//   resolution - high is the slow, "production asset" tier, not what an
//   interactive wait-and-watch UI wants. Medium is the balanced middle.
// - moderation: "low" loosens (doesn't disable) the content filter, so
//   fewer prompts trip the safety system and need the fallback chain below
//   at all - a real latency win given how often it was firing.
async function generateImageFromPrompt(promptText) {
  return openai.images.generate({
    model: "gpt-image-1",
    prompt: promptText,
    n: 1,
    quality: "medium",
    size: "1024x1024",
    moderation: "low",
  });
}

// Asks GPT to rewrite an (already art-directed) prompt so it no longer names
// or otherwise identifies any real, specific person, while preserving every
// other visual detail - mood, setting, color palette, iconography, style -
// as vividly and specifically as before. Rewriting the rich prompt (rather
// than falling back to something generic built from the raw user input)
// is what keeps the retry actually relevant to what the user asked for.
async function removeNamedIndividuals(promptText) {
  const rewritePrompt = `Rewrite the following image description so it no longer names or otherwise identifies any real, specific person (remove names, nicknames, and initials that refer to them), while keeping every other visual detail - mood, setting, color palette, iconography, style - exactly as vivid and specific as before, under 500 characters: "${promptText}"`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: rewritePrompt }],
  });
  return completion.choices[0].message.content.trim();
}

// Tries the art-directed prompt, then - only if that's specifically rejected
// by OpenAI's safety system (any other error propagates immediately) - a
// version of that same prompt with any named real person stripped out.
// Deliberately does not fall back further than that (2 attempts total): a
// prompt thinned out enough to dodge moderation tends to produce an image
// with little relation to what was actually asked for, which is worse than
// no image at all. If the rewritten prompt is also rejected, throws a
// friendly, user-facing error instead of trying yet another, even more
// generic, prompt.
export async function generateImageWithSafetyFallback(artDirectedPrompt) {
  try {
    const response = await generateImageFromPrompt(artDirectedPrompt);
    return { response, generatedPrompt: artDirectedPrompt };
  } catch (error) {
    if (!isSafetySystemRejection(error)) throw error;
    console.warn('Image rejected by safety system, retrying with named individuals removed:', error.message);
  }

  const namelessPrompt = await removeNamedIndividuals(artDirectedPrompt);
  try {
    const response = await generateImageFromPrompt(namelessPrompt);
    return { response, generatedPrompt: namelessPrompt };
  } catch (error) {
    if (!isSafetySystemRejection(error)) throw error;
    const friendlyError = new Error("Sorry, this image can't be generated.");
    friendlyError.isSafetyBlocked = true;
    throw friendlyError;
  }
}
