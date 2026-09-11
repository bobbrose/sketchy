# Vision

## What Sketchy is

Sketchy (product name in the UI: **Soundscapes**) turns a song or artist name into a
piece of AI-generated artwork, and collects everyone's generations into a shared
public gallery.

You type something like `Bohemian Rhapsody by Queen` or `Radiohead`, and a couple
seconds later you get back an image plus the "art direction" that produced it — a
short, specific description of what the image should show and why.

## Why not just ask ChatGPT or Gemini directly?

You *can* ask any chatbot "draw me an image inspired by Bohemian Rhapsody" and get
something back. Sketchy exists because that one-shot request is usually a mediocre
prompt for an image model, and most people don't want to spend time hand-crafting a
better one. The core idea is a **two-step pipeline instead of one step**:

1. **A language model plays art director.** GPT is given a purpose-built prompt that
   asks it to think like someone who knows the song or artist: pull out concrete,
   visual, non-generic details — the mood of the track, an iconic logo, a color
   palette or era associated with the band, imagery from a memorable lyric — and
   write it up as a vivid, specific scene description (see
   [tech-spec.md](tech-spec.md) for the exact prompt).
2. **An image model just renders that scene.** The image generator never sees "Queen"
   or "Bohemian Rhapsody" — it sees a fully fleshed-out visual brief. It's the
   difference between telling a painter "paint me a Beatles song" and handing them a
   paragraph describing the exact scene, palette, and iconography to paint.

Splitting "figure out what this should look like" from "render it" is the whole
point. A single generic prompt tends to regress to the most stereotypical, literal
interpretation of the artist's name; a considered visual brief in between produces
something more specific and more interesting, and it's repeatable without the user
having to become a good prompt engineer themselves.

That intermediate prompt isn't hidden, either — it's shown back to the user
("Inspired from: ...") next to the image. Part of the fun is seeing *why* the image
looks the way it does, and comparing your own mental image of a song against what
the "art director" came up with.

## Why the gallery matters

Every generation (not just your own) lands in a shared, public gallery. That turns a
single-player "generate an image" tool into something closer to a communal mixtape
of album-cover-style art: you can scroll through what other people have tried,
click into any one of them to see both the image and the description that produced
it, and get ideas for your own prompt. It also means there's no login, no saved
history to manage — the gallery *is* your history, shared with everyone else.

## Who this is for

Anyone who wants a quick, low-effort piece of art inspired by music they like —
a single text field, no prompt-engineering skill required, and something shareable
at the end — the Share button copies a link back into the app itself, so whoever
opens it sees the same image (and its "art director" prompt), not just a bare
image file. It's a fun/creative tool first, not a
professional design tool; the About panel in the app is upfront that generated
images aren't guaranteed to stick around, so people should save what they like.

## What would make this better over time

Ideas worth exploring, not commitments:
- Style controls (e.g. "as an oil painting", "as a vintage concert poster") layered
  on top of the generated visual brief, rather than replacing it.
- Per-user history/favorites, if a login is ever added — today the gallery is the
  only "history" and it's shared and size-capped (see tech-spec.md).
- Letting people upvote/react to gallery items, since the gallery is already the
  social layer of the app.
