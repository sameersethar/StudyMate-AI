"""
StudyMate-AI
------------
A study-aid generator for students. Paste in raw notes, a textbook excerpt,
or a lecture transcript, and get back:
  1. A clean, structured summary
  2. Auto-generated flashcards (Q&A pairs)
  3. An auto-generated practice quiz (multiple choice, with explanations)

All AI generation is powered by Groq's LLM API (OpenAI-compatible endpoint),
using system prompts written specifically for each study task.
"""

import os
import json
import re
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import requests

load_dotenv()

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Groq API configuration
# ---------------------------------------------------------------------------
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "REPLACE_WITH_YOUR_GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")


def call_groq(system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> str:
    """Send a chat completion request to Groq and return the raw text response."""
    if not GROQ_API_KEY or GROQ_API_KEY == "REPLACE_WITH_YOUR_GROQ_API_KEY":
        raise RuntimeError(
            "No Groq API key configured. Set GROQ_API_KEY in your .env file."
        )

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }

    response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def extract_json(text: str):
    """
    The model is asked to return raw JSON, but sometimes wraps it in
    ```json ... ``` code fences or adds stray text. This pulls out the
    first valid JSON array/object it can find.
    """
    text = text.strip()
    # Strip markdown code fences if present
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fall back to grabbing the first [...] or {...} block
    for open_c, close_c in [("[", "]"), ("{", "}")]:
        start = text.find(open_c)
        end = text.rfind(close_c)
        if start != -1 and end != -1 and end > start:
            candidate = text[start:end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    raise ValueError("Could not parse JSON from model response")


# ---------------------------------------------------------------------------
# System prompts — the "instructions written by us" for each AI feature
# ---------------------------------------------------------------------------

SUMMARY_SYSTEM_PROMPT = """You are StudyMate, an expert study assistant that turns messy \
student notes, textbook excerpts, or lecture transcripts into clear, exam-ready summaries.

Rules you must follow:
- Identify the core topic and organize the summary under short bolded subheadings.
- Use concise bullet points, not long paragraphs.
- Preserve every important fact, definition, formula, date, or name from the source text.
- Do not invent information that is not present in or reasonably implied by the source text.
- Keep the summary shorter than the original but do not omit key concepts.
- End with a short "Key Takeaways" section of 3-5 bullet points.
- Format the output using Markdown (headings, bold, bullet lists).
- Do not include any preamble like "Here is your summary" — output the summary directly.
"""

FLASHCARDS_SYSTEM_PROMPT = """You are StudyMate, an AI that converts study material into \
active-recall flashcards for spaced-repetition learning.

Rules you must follow:
- Generate exactly the requested number of flashcards from the given text.
- Each flashcard must test ONE specific fact, concept, or definition — not vague or overly broad questions.
- Questions should be answerable using only the given text.
- Answers must be concise (1-3 sentences), accurate, and self-contained.
- Do not repeat the same concept across multiple cards.
- Output ONLY a raw JSON array, with no explanation, no markdown fences, and no extra text.
- Each element must be an object of exactly this shape:
  {"question": "...", "answer": "..."}
"""

QUIZ_SYSTEM_PROMPT = """You are StudyMate, an AI that writes multiple-choice practice quizzes \
to help students test their understanding of study material.

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
"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json(force=True) or {}
    mode = data.get("mode")
    text = (data.get("text") or "").strip()
    count = int(data.get("count", 8))
    difficulty = data.get("difficulty", "medium")

    if not text:
        return jsonify({"error": "Please paste some notes or text first."}), 400

    if len(text) < 40:
        return jsonify({"error": "Please provide a bit more text (at least a few sentences) so StudyMate has enough to work with."}), 400

    try:
        if mode == "summary":
            user_prompt = f"Summarize the following study material:\n\n{text}"
            result_text = call_groq(SUMMARY_SYSTEM_PROMPT, user_prompt)
            return jsonify({"mode": "summary", "summary": result_text})

        elif mode == "flashcards":
            user_prompt = (
                f"Generate exactly {count} flashcards from the following study material:\n\n{text}"
            )
            raw = call_groq(FLASHCARDS_SYSTEM_PROMPT, user_prompt, max_tokens=2500)
            cards = extract_json(raw)
            if not isinstance(cards, list):
                raise ValueError("Expected a JSON array of flashcards")
            return jsonify({"mode": "flashcards", "flashcards": cards})

        elif mode == "quiz":
            user_prompt = (
                f"Generate exactly {count} {difficulty}-difficulty multiple-choice questions "
                f"from the following study material:\n\n{text}"
            )
            raw = call_groq(QUIZ_SYSTEM_PROMPT, user_prompt, max_tokens=3000)
            questions = extract_json(raw)
            if not isinstance(questions, list):
                raise ValueError("Expected a JSON array of quiz questions")
            return jsonify({"mode": "quiz", "quiz": questions})

        else:
            return jsonify({"error": f"Unknown mode: {mode}"}), 400

    except RuntimeError as e:
        # Missing API key
        return jsonify({"error": str(e)}), 500
    except requests.HTTPError as e:
        return jsonify({"error": f"Groq API error: {e.response.status_code} - {e.response.text[:200]}"}), 502
    except ValueError as e:
        return jsonify({"error": f"AI returned an unexpected format. Please try again. ({e})"}), 502
    except Exception as e:
        return jsonify({"error": f"Something went wrong: {str(e)}"}), 500


@app.route("/healthz")
def healthz():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
