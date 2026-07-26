# StudyMate-AI

**Turn messy notes into study material — instantly.**

## a. What it is & the problem it solves

StudyMate-AI is a web app for students who spend more time *reorganizing* their notes than
actually *studying* them. You paste in raw material — lecture notes, a textbook excerpt, an
article, a transcript, anything — and StudyMate-AI turns it into three ready-to-use study
formats:

- A clean, structured **summary**
- A deck of **flashcards** for active recall
- A **multiple-choice practice quiz** with explanations, so you can test yourself before an exam

**Who it's for:** any student (school, university, self-learners) who has a pile of raw
material and no time to manually turn it into flashcards or a quiz before a test. Instead of
spending an hour making 10 flashcards by hand, you paste your notes in and get them in seconds
— then spend your actual study time recalling and testing, not formatting.

This is not a generic "chat with an AI" wrapper — it's a purpose-built workflow with three
distinct, structured outputs, each driven by its own carefully written prompt (see section d).

## b. Live URL

🔗 **[https://your-deployment-url-here.onrender.com](https://your-deployment-url-here.onrender.com)**

> Replace this with your actual deployed URL once you've shipped it (see "How to deploy" below).

## c. Features

- **Paste-and-go input** — no file uploads or accounts required, just paste text and go
- **Summary mode** — generates a structured, headed, bullet-point summary with a "Key
  Takeaways" section, using Markdown formatting rendered live in the browser
- **Flashcards mode** — generates a configurable number of Q&A flashcards (5 / 8 / 12 / 15)
  with a physical-feeling flip animation and a stacked "index card" visual, plus prev/next
  navigation through the deck
- **Quiz mode** — generates a configurable number of multiple-choice questions at a chosen
  difficulty (easy / medium / hard), lets you select an answer per question, then reveals
  correct/incorrect answers with a one-line explanation and a final score
- **Input validation** — rejects empty or too-short input with a clear, actionable error
  message instead of silently failing
- **Graceful error handling** — if the AI response can't be parsed, or the Groq API key is
  missing/invalid, the app shows a specific, readable error instead of crashing
- **Fully responsive** — usable on mobile and desktop
- **No database, no login** — zero setup friction for the person using it; everything happens
  in the current session

## d. The AI feature

StudyMate-AI's entire value is its AI feature: three distinct generation modes, each backed by
its own system prompt (written specifically for this app, not a generic "assistant" prompt).
All requests go to **Groq's chat completions API** (OpenAI-compatible endpoint) using the
`llama-3.3-70b-versatile` model.

### How it works
1. The user pastes text and picks a mode (summary / flashcards / quiz).
2. The Flask backend sends the text to Groq along with the relevant system prompt below.
3. For flashcards/quiz, the model is instructed to return **strict JSON**, which the backend
   parses (`extract_json` handles stray markdown fences or preamble the model might add) and
   returns to the frontend for rendering.
4. The frontend renders the result as an interactive flashcard deck, an interactive quiz, or a
   formatted summary.

### The system prompts (verbatim, from `app.py`)

**Summary prompt:**
```
You are StudyMate, an expert study assistant that turns messy student notes, textbook
excerpts, or lecture transcripts into clear, exam-ready summaries.

Rules you must follow:
- Identify the core topic and organize the summary under short bolded subheadings.
- Use concise bullet points, not long paragraphs.
- Preserve every important fact, definition, formula, date, or name from the source text.
- Do not invent information that is not present in or reasonably implied by the source text.
- Keep the summary shorter than the original but do not omit key concepts.
- End with a short "Key Takeaways" section of 3-5 bullet points.
- Format the output using Markdown (headings, bold, bullet lists).
- Do not include any preamble like "Here is your summary" — output the summary directly.
```

**Flashcards prompt:**
```
You are StudyMate, an AI that converts study material into active-recall flashcards for
spaced-repetition learning.

Rules you must follow:
- Generate exactly the requested number of flashcards from the given text.
- Each flashcard must test ONE specific fact, concept, or definition — not vague or overly
  broad questions.
- Questions should be answerable using only the given text.
- Answers must be concise (1-3 sentences), accurate, and self-contained.
- Do not repeat the same concept across multiple cards.
- Output ONLY a raw JSON array, with no explanation, no markdown fences, and no extra text.
- Each element must be an object of exactly this shape:
  {"question": "...", "answer": "..."}
```

**Quiz prompt:**
```
You are StudyMate, an AI that writes multiple-choice practice quizzes to help students test
their understanding of study material.

Rules you must follow:
- Generate exactly the requested number of multiple-choice questions from the given text.
- Each question must have exactly 4 answer options, only one of which is correct.
- Distractor (incorrect) options must be plausible, not obviously wrong or silly.
- Base every question strictly on the provided text — do not invent unrelated facts.
- Match the requested difficulty level:
  - "easy": direct recall of definitions/facts stated in the text.
  - "medium": requires connecting two ideas from the text.
  - "hard": requires applying or reasoning about a concept from the text.
- Provide a short one-sentence explanation of why the correct answer is correct.
- Output ONLY a raw JSON array, with no explanation, no markdown fences, and no extra text.
- Each element must be an object of exactly this shape:
  {"question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0, "explanation": "..."}
```

## e. Tools, services, and models used

- **Backend:** Python 3, Flask
- **AI model/provider:** Groq API (`llama-3.3-70b-versatile`) via the OpenAI-compatible
  `/openai/v1/chat/completions` endpoint, called with `requests`
- **Frontend:** vanilla HTML/CSS/JS (no framework) — custom "study desk" design with a ruled
  paper background and a physical flip-card interaction for flashcards
- **Fonts:** Lora (display/serif), Inter (body), JetBrains Mono (labels) via Google Fonts
- **Deployment:** Render / Railway (Flask + gunicorn) — a `vercel.json` is also included for
  Vercel deployment as an alternative
- **Dependencies:** `Flask`, `requests`, `python-dotenv`, `gunicorn` (see `requirements.txt`)

## f. Screenshots

> See the `screenshots/` folder — add at least 3 screenshots of the app running (summary,
> flashcards, and quiz views) after you deploy with your own Groq key, then reference them
> here, e.g.:

![Summary feature](screenshots/01-summary.png)
![Flashcards feature](screenshots/02-flashcards.png)
![Quiz feature](screenshots/03-quiz.png)

## g. How to run this project

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/StudyMate-AI.git
cd StudyMate-AI
```

### 2. Get a free Groq API key
Sign up at [console.groq.com](https://console.groq.com), create an API key.

### 3. Set up your environment
```bash
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the project root (already gitignored) with:
```
GROQ_API_KEY=your_real_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=5000
```

### 4. Run locally
```bash
python3 app.py
```
Open **http://localhost:5000** in your browser.

### 5. Deploy live (Render — recommended for Flask)
1. Push this repo to GitHub (public).
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app`
5. Add environment variables in the Render dashboard: `GROQ_API_KEY`, `GROQ_MODEL`.
6. Deploy — Render gives you a public `https://your-app.onrender.com` URL.

*(Railway works the same way. A `vercel.json` is included if you prefer Vercel instead.)*

### 6. Never commit your real API key
The `.env` file is already in `.gitignore`. Only set `GROQ_API_KEY` as an environment variable
on your hosting provider's dashboard — never hardcode it in `app.py` or commit it to GitHub.

---

Built as a final project — an original tool for a real student problem, with an AI feature
driven by prompts written specifically for this use case.
