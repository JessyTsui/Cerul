from backend.app.embedding import EmbeddingBackend
from workers.common.pipeline import PipelineContext, PipelineStep


class GenerateClipEmbeddingStep(PipelineStep):
    step_name = "GenerateClipEmbeddingStep"

    def __init__(self, embedding_backend: EmbeddingBackend | None = None) -> None:
        self._embedding_backend = embedding_backend

    async def _process(self, context: PipelineContext) -> None:
        embedding_backend = self._embedding_backend or context.conf.get(
            "embedding_backend"
        )
        if embedding_backend is None:
            raise RuntimeError("An embedding backend is required.")

        embeddings: dict[str, list[float]] = {}
        embedding_errors: dict[str, str] = {}
        frame_paths = context.data.get("frame_paths", {})
        expected_dimension: int | None = None

        for asset in context.data.get("assets", []):
            asset_id = asset["id"]
            frame_path = frame_paths.get(asset_id)
            if not frame_path:
                embedding_errors[asset_id] = "Missing preview frame."
                continue

            try:
                vector = list(embedding_backend.embed_image(frame_path))
            except Exception as exc:
                embedding_errors[asset_id] = str(exc)
                continue

            if expected_dimension is None:
                try:
                    expected_dimension = embedding_backend.dimension()
                except Exception:
                    expected_dimension = len(vector)

            if len(vector) != expected_dimension:
                raise ValueError(
                    f"Embedding dimension mismatch for {asset_id}: "
                    f"expected {expected_dimension}, got {len(vector)}."
                )

            embeddings[asset_id] = vector

        context.data["embeddings"] = embeddings
        if expected_dimension is not None:
            context.data["embedding_dimension"] = expected_dimension
        if embedding_errors:
            context.data["embedding_errors"] = embedding_errors
