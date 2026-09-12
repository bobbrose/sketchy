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

// Turns a raw song/artist name into a vivid, specific visual brief for the
// image model - the "art direction" step described in docs/vision.md. This
// prompt is the whole differentiator of the app, so gpt-4o-mini (not the
// older/weaker gpt-3.5-turbo) is used here for quality, even though it's not
// the model that actually renders the image.
export async function generateArtDirectedPrompt(rawPrompt) {
  const wrappedPrompt = `Create a vivid and detailed description for an image based on the following song or band, under 500 characters, keep it safe and non explicit, use the band's iconography, album art style, color palette, or unique graphics if available: "${rawPrompt}". The description should describe the song or artist in vivid detail with specific references to the song or something distinctive about the artist so an image can be generated from the description. Favor mood, setting, symbolic or stylized visual elements (an iconic outfit or prop, a stage setup, an album-cover aesthetic, a silhouette) over describing any real person's actual face or likeness. If there is an iconic logo or visual reference for the band, include that in the image.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: wrappedPrompt }],
  });

  return completion.choices[0].message.content.trim();
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
