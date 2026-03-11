from __future__ import annotations

from workers.common.pipeline import PipelineContext, PipelineStep
from workers.knowledge.repository import KnowledgeRepository


class StoreKnowledgeSegmentsStep(PipelineStep):
    step_name = "StoreKnowledgeSegmentsStep"

    def __init__(
        self,
        repository: KnowledgeRepository | None = None,
    ) -> None:
        self._repository = repository

    async def _process(self, context: PipelineContext) -> None:
        repository = self._repository or context.conf.get("repository")
        if repository is None:
            raise RuntimeError("A knowledge repository is required.")

        video_metadata = context.data.get("video_metadata")
        segments = context.data.get("segments")
        segment_embeddings = context.data.get("segment_embeddings", {})
        if video_metadata is None or segments is None:
            raise RuntimeError("Knowledge storage requires metadata and segments.")

        missing_embedding_indexes = [
            int(segment["segment_index"])
            for segment in segments
            if int(segment["segment_index"]) not in segment_embeddings
        ]
        if missing_embedding_indexes:
            missing_indexes_literal = ", ".join(
                str(segment_index) for segment_index in missing_embedding_indexes
            )
            raise ValueError(
                "Knowledge storage requires embeddings for every segment. "
                f"Missing segment indexes: {missing_indexes_literal}."
            )

        stored_video = await repository.upsert_knowledge_video(video_metadata)
        video_id = str(stored_video["id"])
        stored_segments = await repository.replace_knowledge_segments(
            video_id=video_id,
            segments=[
                {
                    **dict(segment),
                    "embedding": segment_embeddings[int(segment["segment_index"])],
                }
                for segment in segments
            ],
        )

        context.data["stored_video"] = stored_video
        context.data["stored_segments"] = stored_segments
        context.data["knowledge_video_id"] = video_id
        context.data["indexed_segment_count"] = len(stored_segments)
