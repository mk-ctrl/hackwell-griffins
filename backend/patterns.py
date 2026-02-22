"""
MindArmor XAI — Propaganda / fallacy / cognitive-bias pattern database.

Each category carries:
  - keywords   : trigger words / phrases to scan for
  - description: what the technique does psychologically
  - example    : canonical manipulative sentence
  - weight     : how much a match contributes to the risk score (0–1)
  - system     : which Dual-Process system it primarily exploits
"""

from __future__ import annotations

PATTERNS: dict[str, dict] = {
    # ── Emotional appeals ────────────────────────────────────────────────────
    "fear appeal": {
        "keywords": [
            "crisis", "disaster", "catastrophe", "collapse", "danger",
            "threat", "devastating", "terrifying", "nightmare", "doom",
            "panic", "alarming", "fatal", "deadly", "destroy", "destruction",
            "annihilate", "apocalypse", "horrifying", "peril",
        ],
        "description": (
            "Exploits the amygdala's threat-detection system to bypass "
            "rational evaluation. Triggers fight-or-flight before the "
            "prefrontal cortex can engage."
        ),
        "example": "This crisis will DESTROY everything we hold dear!",
        "weight": 0.85,
        "system": 1,
    },

    "anger / outrage": {
        "keywords": [
            "outrageous", "disgusting", "shameful", "betrayal", "attack",
            "scandal", "corrupt", "unforgivable", "rage", "infuriating",
            "despicable", "revolting", "sickening", "abhorrent", "vile",
            "treachery", "heinous",
        ],
        "description": (
            "Anger narrows attention and increases certainty bias, making "
            "the reader more likely to accept conclusions without scrutiny."
        ),
        "example": "This DISGUSTING betrayal by our leaders is unforgivable!",
        "weight": 0.80,
        "system": 1,
    },

    "urgency": {
        "keywords": [
            "act now", "immediately", "urgent", "last chance", "running out",
            "before it's too late", "don't wait", "right now", "hurry",
            "time is running out", "deadline", "limited time",
        ],
        "description": (
            "Creates artificial time pressure that forces System 1 snap "
            "decisions by preventing deliberative System 2 processing."
        ),
        "example": "Act NOW before it's too late — this is your LAST CHANCE!",
        "weight": 0.70,
        "system": 1,
    },

    "scarcity": {
        "keywords": [
            "only a few left", "exclusive", "limited", "rare", "once in a lifetime",
            "never again", "sold out soon", "scarce", "dwindling",
            "disappearing", "running low",
        ],
        "description": (
            "Exploits loss aversion (Kahneman & Tversky): we weight losses "
            "~2× more than equivalent gains, creating irrational urgency."
        ),
        "example": "Only 3 spots left — this exclusive offer won't last!",
        "weight": 0.65,
        "system": 1,
    },

    # ── Logical fallacies ────────────────────────────────────────────────────
    "ad hominem": {
        "keywords": [
            "idiot", "moron", "fool", "stupid", "incompetent", "clueless",
            "ignorant", "liar", "fraud", "hypocrite", "clown", "joke",
            "pathetic", "laughable",
        ],
        "description": (
            "Attacks the person rather than the argument, diverting "
            "attention from the actual claims being made."
        ),
        "example": "Only an idiot would believe that so-called 'expert'.",
        "weight": 0.75,
        "system": 1,
    },

    "strawman": {
        "keywords": [
            "so you're saying", "what they really mean", "in other words",
            "basically wants", "trying to", "actually believes",
        ],
        "description": (
            "Misrepresents someone's position to make it easier to attack, "
            "creating an illusion of refutation."
        ),
        "example": "So you're saying we should just give up entirely?",
        "weight": 0.70,
        "system": 2,
    },

    "false dilemma": {
        "keywords": [
            "either", "or else", "only two choices", "you're either",
            "with us or against", "no middle ground", "only option",
            "pick a side", "there is no alternative",
        ],
        "description": (
            "Presents a complex issue as having only two options, "
            "eliminating nuance and forcing premature commitment."
        ),
        "example": "You're either with us or against us — there's no middle ground.",
        "weight": 0.70,
        "system": 2,
    },

    "bandwagon": {
        "keywords": [
            "everyone knows", "everybody agrees", "millions", "most people",
            "the majority", "widespread", "popular opinion", "consensus",
            "nobody disagrees", "it's obvious",
        ],
        "description": (
            "Exploits tribal instincts: humans evolved to follow group "
            "consensus for survival, bypassing individual judgement."
        ),
        "example": "Everyone agrees this is the best approach — don't be left behind!",
        "weight": 0.65,
        "system": 1,
    },

    "slippery slope": {
        "keywords": [
            "next thing you know", "slippery slope", "where does it end",
            "before you know it", "inevitably lead to", "domino effect",
            "opens the door", "floodgates",
        ],
        "description": (
            "Argues that a small first step will inevitably chain into "
            "extreme consequences, without justifying the causal links."
        ),
        "example": "If we allow this, next thing you know they'll take everything!",
        "weight": 0.65,
        "system": 2,
    },

    "appeal to authority": {
        "keywords": [
            "experts say", "studies show", "scientists agree",
            "according to experts", "research proves", "authorities confirm",
            "top officials", "leading scholars",
        ],
        "description": (
            "Invokes vague authority without citing specific sources, "
            "leveraging trust in expertise to shut down questioning."
        ),
        "example": "Experts say this is undeniable — you can't argue with science!",
        "weight": 0.55,
        "system": 2,
    },

    # ── Cognitive biases / framing ───────────────────────────────────────────
    "absolute language": {
        "keywords": [
            "always", "never", "everyone", "no one", "all", "none",
            "every single", "without exception", "absolutely",
            "completely", "totally", "entirely", "undeniably",
        ],
        "description": (
            "Universal quantifiers feel authoritative but are almost "
            "never factually true. They prevent nuance and exception."
        ),
        "example": "They ALWAYS lie — NEVER trust a word they say!",
        "weight": 0.60,
        "system": 2,
    },

    "emotional framing": {
        "keywords": [
            "heartbreaking", "hero", "villain", "victim", "innocent",
            "evil", "pure", "champion", "savior", "sacrifice", "tragic",
            "miracle", "dream", "nightmare",
        ],
        "description": (
            "Selects emotionally charged words where neutral alternatives "
            "exist, shaping perception before evaluation begins."
        ),
        "example": "Our heroic fighters sacrifice everything against pure evil.",
        "weight": 0.60,
        "system": 1,
    },

    "loaded question": {
        "keywords": [
            "why do they", "how can anyone", "isn't it obvious",
            "don't you think", "wouldn't you agree", "are you really",
            "how dare",
        ],
        "description": (
            "Embeds a presupposition in a question, forcing the responder "
            "to accept an unproven premise."
        ),
        "example": "How can anyone support such a disastrous policy?",
        "weight": 0.55,
        "system": 2,
    },
}


# ── Neutralization word map ──────────────────────────────────────────────────
# Maps loaded words → neutral alternatives for rewriting.
NEUTRALIZATION_MAP: dict[str, str] = {
    # Fear
    "crisis": "situation",
    "disaster": "challenge",
    "catastrophe": "difficulty",
    "collapse": "decline",
    "destroy": "affect",
    "destruction": "impact",
    "devastating": "significant",
    "terrifying": "concerning",
    "nightmare": "challenge",
    "doom": "uncertainty",
    "panic": "concern",
    "alarming": "notable",
    "fatal": "serious",
    "deadly": "serious",
    "annihilate": "reduce",
    "apocalypse": "major change",
    "horrifying": "troubling",
    "peril": "risk",
    # Outrage
    "outrageous": "questionable",
    "disgusting": "concerning",
    "shameful": "problematic",
    "betrayal": "disagreement",
    "scandal": "controversy",
    "corrupt": "questioned",
    "unforgivable": "serious",
    "infuriating": "frustrating",
    "despicable": "problematic",
    "revolting": "concerning",
    "sickening": "troubling",
    "vile": "problematic",
    "heinous": "severe",
    # Urgency
    "urgent": "timely",
    "immediately": "soon",
    "hurry": "consider",
    # Absolutes
    "always": "often",
    "never": "rarely",
    "everyone": "many people",
    "no one": "few people",
    "absolutely": "largely",
    "completely": "mostly",
    "totally": "mostly",
    "entirely": "mostly",
    "undeniably": "arguably",
    # Ad hominem
    "idiot": "person",
    "moron": "person",
    "fool": "person",
    "stupid": "questionable",
    "incompetent": "inexperienced",
    "clueless": "uninformed",
    "ignorant": "unfamiliar",
    "liar": "disputed source",
    "fraud": "disputed figure",
    "hypocrite": "inconsistent",
    "clown": "individual",
    "pathetic": "underwhelming",
    # Emotional framing
    "evil": "opposing",
    "villain": "opponent",
    "hero": "advocate",
    "victim": "affected person",
    "miracle": "positive development",
    "tragic": "unfortunate",
    "sacrifice": "effort",
}
