"""Embedding service using OpenAI API - lightweight alternative to sentence-transformers.

This avoids pulling in PyTorch (~2GB) into the Docker image.
Uses OpenAI text-embedding-3-small (1536 dimensions) for semantic search.
Falls back to a simple TF-IDF approach if OpenAI is not configured.
"""
import hashlib
import os
from typing import Optional

import numpy as np

# Cache for embeddings to avoid redundant API calls
_embedding_cache: dict[str, list[float]] = {}

# Embedding dimension - OpenAI text-embedding-3-small uses 1536
EMBEDDING_DIM = 384  # Match pgvector column dimension from schema


def _cache_key(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def get_embedding(text: str) -> Optional[list[float]]:
    """Generate embedding for text using OpenAI API.

    Falls back to simple hash-based embedding if OpenAI is unavailable.
    """
    if not text or not text.strip():
        return None

    cache_key = _cache_key(text)
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    # Try OpenAI embeddings first
    openai_key = os.getenv("OPENAI_API_KEY", "")
    if openai_key and not openai_key.startswith("sk-placeholder"):
        try:
            embedding = _openai_embedding(text, openai_key)
            if embedding:
                _embedding_cache[cache_key] = embedding
                return embedding
        except Exception as e:
            print(f"[EMBEDDING] OpenAI embedding failed: {e}")

    # Fallback: simple TF-IDF-like embedding using hashing trick
    embedding = _hash_embedding(text)
    _embedding_cache[cache_key] = embedding
    return embedding


def _openai_embedding(text: str, api_key: str) -> Optional[list[float]]:
    """Get embedding from OpenAI API."""
    import httpx

    response = httpx.post(
        "https://api.openai.com/v1/embeddings",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "text-embedding-3-small",
            "input": text[:8000],  # Truncate to avoid token limits
            "dimensions": EMBEDDING_DIM,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()
    return data["data"][0]["embedding"]


def _hash_embedding(text: str) -> list[float]:
    """Generate a deterministic embedding using hashing trick.

    Not as good as neural embeddings but works without external APIs.
    Similar texts will have somewhat similar embeddings due to n-gram overlap.
    """
    # Tokenize into character n-grams (3-grams)
    text = text.lower().strip()
    tokens = []
    words = text.split()
    for word in words:
        tokens.append(word)
        for i in range(len(word) - 2):
            tokens.append(word[i:i + 3])

    # Hash each token into the embedding space
    embedding = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    for token in tokens:
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        idx = h % EMBEDDING_DIM
        sign = 1 if (h >> 128) % 2 == 0 else -1
        embedding[idx] += sign

    # L2 normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding.tolist()
