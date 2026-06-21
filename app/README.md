# voicepost

Turn voice memos into X posts and blog drafts that sound like you wrote them — because you did. You just spoke them.

![voicepost demo](assets/demo.gif)

## What it does

You record a voice memo on your phone. You drag the audio file into voicepost. About thirty seconds later you have two things: an X post (short, long-form, or thread — the tool decides which fits) and a blog post, both shaped in your voice, ready to copy and publish.

The pipeline is straightforward:

- **xAI Grok** transcribes your audio
- **Anthropic Claude** turns the transcript into content
- Three modes let you dial between **pure voice** and **wider reach**
- A **coherence reviewer** catches when a post drifts from what it set out to say, and shows you a tightened version so you can choose

The voice is configured in plain prompt files you can edit. Out of the box, the tool writes in the voice of one specific person (Travis Kolder). To make it yours, you edit one folder. More on that below.

## What you need

- An [xAI API key](https://x.ai) — Grok handles transcription. Roughly $0.10 per hour of audio. iPhone voice memos work natively (`.m4a`).
- An [Anthropic API key](https://console.anthropic.com) — Claude handles the writing. Roughly $0.02–0.05 per voice memo at current pricing.
- Node.js 20 or higher
- Five minutes

Approximate cost per voice memo: a few cents. A normal month of personal use runs $1–5 on your own API accounts.

## Install

```bash
git clone https://github.com/YOURUSERNAME/voicepost.git
cd voicepost
npm install
cp .env.example .env.local
```

Open `.env.local` and add your two API keys:

```
XAI_API_KEY=your_xai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're in.

## How to use

1. Drag a voice memo into the upload area (`.m4a`, `.mp3`, `.wav`, `.webm`, and others all work)
2. Pick a mode (Voice-First, Balanced, or Reach-First — see below)
3. Click Generate
4. About 30 seconds later, your X post and blog draft appear
5. Edit them in place if you want, then copy them out

You can re-record and re-run as many times as you want. Nothing is stored — outputs live in your browser until you copy them.

## The three modes

**Voice-First** — Maximum fidelity to your voice. The output sounds as much like you as the tool can manage. No optimization for spread, no sharpening for reach. Use this when craft matters more than virality — personal stories, faith reflections, anything you'd rather have fifty people read closely than five thousand scroll past.

**Balanced** (default) — Your voice with sharper edges. Stronger openings, faster to the point, more willing to use a numbered structure when the content supports it. Still recognizably you; tuned a little for engagement.

**Reach-First** — Optimizes for spread within hard guardrails. Punchier openings, stronger central claims earlier, contrarian framings when the content supports them. Still your voice, but pulling harder. Built-in guardrails refuse to manufacture outrage, fake stories, or claims you wouldn't defend.

## Other features

**Coherence reviewer.** After generating, a second agent checks each output for drift between opening and ending. If a post starts making one point and lands on a different one, you'll see both versions side by side — the original and a tightened version that lands on what the opening promised — and you choose.

**Source flagging.** When you say something like "insert source here" or "I read somewhere that 40% of teens..." the tool flags those spots in your output (`[INSERT SOURCE: brief description]`) and gives you a list at the end of sources to fill in before publishing. So you can record freely without breaking flow to look things up.

**In-page editing.** Click into any output and edit it directly. The copy button grabs your edited version. The X post shows a live character count. If you've edited something and try to regenerate, the tool warns you before discarding your changes.

**Format intelligence.** The tool picks the X format (short single post, long-form, or thread) based on what the content actually is — not a fixed rule.

## Make it sound like you

This is the part that matters if you fork this tool. Out of the box, voicepost writes in one specific person's voice. To make it yours, you edit one folder:

```
lib/prompts/
├── voice-spec.ts       ← THE SOUL. Edit this with your voice.
├── x-format.ts         ← X-specific format rules
├── blog-format.ts      ← Blog format rules
├── modes.ts            ← The three mode layers
└── compose.ts          ← Wires them together (don't edit)
```

**Start with `voice-spec.ts`.** It contains:

- A description of how you write
- Real example openings from your published writing
- Real example landing lines you've used
- Specific phrases and patterns that are yours
- Vocabulary preferences (what you say, what you don't)
- Editorial rules for how to handle voice-memo material

Replace the examples with your own. Pull from your blog, your X account, your published work. The more specific and real the examples, the better the voice matches. Generic instructions ("write practically and insightfully") produce generic AI output. Specific patterns ("I often start with 'For the last X years' or 'Three weeks ago, a friend...'") produce something that sounds like you.

A good first pass takes an hour or two:

1. Read through `voice-spec.ts` to understand its structure
2. Replace the "real opening lines" section with 5–10 real opening lines from your own writing
3. Replace the "real landing lines" section with your real closing lines
4. Replace the list of "specific patterns" with phrases you actually use
5. Edit the vocabulary sections to match your domain (if you don't write about faith, replace the faith vocabulary section with whatever your subject matter is)
6. Generate a few posts and tune the examples based on what comes out

The other files (`x-format.ts`, `blog-format.ts`, `modes.ts`) are mostly format and craft rules — you may not need to touch them at all. The voice file is where the personalization lives.

## What's not in here (yet)

- No accounts, no auth, no database. Everything is stateless — your data never leaves your machine except to call the two APIs.
- No deployment instructions. The tool runs locally by default. If you want to host it, standard Next.js deployment to Vercel or similar works, but you'd want to think about how API keys are managed.
- No mobile-first UI. The interface works on phones but is built for desktop.

These are deliberate v1 decisions, not omissions. The tool does one thing well: turns voice memos into your-voice posts. Anything past that is yours to build.

## Tech stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- No database

## License

MIT. Fork it, edit your voice spec, ship something.

## Acknowledgments

Built with [Claude Code](https://www.anthropic.com/claude-code). Transcription by [xAI Grok](https://x.ai). Writing by [Anthropic Claude](https://www.anthropic.com).
