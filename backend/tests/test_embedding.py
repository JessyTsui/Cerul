from app.embedding.clip import ClipEmbeddingBackend


def test_clip_embedding_dimension_uses_loaded_model_metadata(monkeypatch) -> None:
    backend = ClipEmbeddingBackend(model_name="ViT-L-14")

    def fake_ensure_model() -> None:
        backend._output_dim = 768

    monkeypatch.setattr(backend, "_ensure_model", fake_ensure_model)

    assert backend.dimension() == 768
