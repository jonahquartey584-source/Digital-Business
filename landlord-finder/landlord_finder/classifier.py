"""Private-landlord vs. property-management/agency classifier.

Two signals are blended together:

1. A small TF-IDF + Logistic Regression text classifier, trained on
   ``data/labeled_examples.csv``. You can (and should) add more of your own
   labeled examples as you see real listings — it only gets better with
   more data. Retrain with: ``python -m landlord_finder.cli train``

2. A transparent rule-based heuristic (regex signals for phrases like
   "no agents", "property management", "leasing office", "application fee")
   that acts as a sanity check and keeps the tool useful even before you've
   trained/retrained the model.

The final score is the average of the two, in [0.0, 1.0], where higher means
"more likely a private landlord, not an agency/property manager".
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "model.joblib")
LABELED_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "labeled_examples.csv")

OWNER_SIGNALS = [
    r"\bno agents?\b",
    r"\bno realtors?\b",
    r"\bno brokers?\b",
    r"\bprincipals? only\b",
    r"\bprivate (landlord|owner)\b",
    r"\bby owner\b",
    r"\bi am the owner\b",
    r"\bowner[- ]?occupied\b",
    r"\bowner[- ]?managed\b",
    r"\bcontact (me|the owner) directly\b",
    r"\bno (property )?management company\b",
    r"\bno application fee\b",
    r"\bno letting agents?\b",
    r"\bno agency fees?\b",
    r"\bnot an agent\b",
    r"\bnot a letting agency\b",
]

AGENCY_SIGNALS = [
    r"\bproperty management\b",
    r"\bmanagement (company|group|llc|inc)\b",
    r"\bleasing (office|agent|team)\b",
    r"\brealty\b",
    r"\bbrokerage\b",
    r"\blicensed (real estate )?(agent|broker)\b",
    r"\bapplication fee\b",
    r"\bnow leasing\b",
    r"\bcredit and background check\b",
    r"\bresident portal\b",
    r"\bon-?site (staff|maintenance)\b",
    r"\bequal housing opportunity\b",
    r"\bletting agen(t|cy|cies)\b",
    r"\blettings (team|negotiator|office|portfolio)\b",
    r"\btenant find fee\b",
    r"\breferencing (fee|required)\b",
    r"\bmanaged portfolio\b",
]


def _compile(patterns: list[str]):
    return [re.compile(p, re.IGNORECASE) for p in patterns]


_OWNER_RE = _compile(OWNER_SIGNALS)
_AGENCY_RE = _compile(AGENCY_SIGNALS)


def rule_based_score(text: str) -> float:
    """Cheap, explainable heuristic score in [0, 1]. 0.5 = no signal either way."""
    text = text or ""
    owner_hits = sum(1 for pat in _OWNER_RE if pat.search(text))
    agency_hits = sum(1 for pat in _AGENCY_RE if pat.search(text))
    if owner_hits == 0 and agency_hits == 0:
        return 0.5
    # Simple logistic-ish squash of (owner_hits - agency_hits)
    diff = owner_hits - agency_hits
    return max(0.0, min(1.0, 0.5 + 0.15 * diff))


@dataclass
class Classifier:
    model: object | None = None

    @classmethod
    def load(cls) -> "Classifier":
        if os.path.exists(MODEL_PATH):
            return cls(model=joblib.load(MODEL_PATH))
        return cls(model=None)

    def score(self, text: str) -> float:
        """Blended confidence in [0, 1] that `text` describes a private-landlord listing."""
        rule_score = rule_based_score(text)
        if self.model is None:
            return rule_score
        proba = self.model.predict_proba([text or ""])[0]
        classes = list(self.model.classes_)
        ml_score = proba[classes.index("owner")] if "owner" in classes else 0.5
        return (rule_score + ml_score) / 2


def train(labeled_csv: str = LABELED_DATA_PATH, model_path: str = MODEL_PATH) -> str:
    """Train (or retrain) the TF-IDF + LogisticRegression classifier and save it.

    Returns a short human-readable summary of the result.
    """
    import pandas as pd
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.model_selection import cross_val_score

    df = pd.read_csv(labeled_csv)
    df = df.dropna(subset=["text", "label"])
    if df["label"].nunique() < 2:
        raise ValueError("Need at least two label classes ('owner' and 'agency') to train.")

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, stop_words="english")),
        ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
    ])

    scores = []
    try:
        scores = cross_val_score(pipeline, df["text"], df["label"], cv=min(5, df["label"].value_counts().min()))
    except Exception:
        pass  # not enough data per class for CV yet; still fine to fit on all of it

    pipeline.fit(df["text"], df["label"])
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(pipeline, model_path)

    summary = f"Trained on {len(df)} labeled examples."
    if len(scores):
        summary += f" Cross-val accuracy: {scores.mean():.2f} (+/- {scores.std():.2f})."
    summary += f" Model saved to {model_path}."
    return summary
