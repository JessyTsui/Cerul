import asyncio

from workers.broll.repository import InMemoryBrollAssetRepository
from workers.broll.steps import (
    DiscoverAssetStep,
    FetchAssetMetadataStep,
    GenerateClipEmbeddingStep,
)
from workers.common.pipeline import PipelineContext


class FakeEmbeddingBackend:
    name = "fake-clip"

    def dimension(self) -> int:
        return 512

    def embed_text(self, text: str) -> list[float]:
        return [0.0] * self.dimension()

    def embed_image(self, image_path: str) -> list[float]:
        return [float(index) for index in range(self.dimension())]


class FakeSourceClient:
    def __init__(self, payload: list[dict[str, object]]) -> None:
        self._payload = payload

    async def search_videos(self, query: str, per_page: int = 50) -> list[dict[str, object]]:
        return self._payload


def test_fetch_asset_metadata_step_normalizes_pexels_payload() -> None:
    repository = InMemoryBrollAssetRepository()
    step = FetchAssetMetadataStep(repository=repository)
    context = PipelineContext(
        data={
            "raw_assets": [
                {
                    "source": "pexels",
                    "payload": {
                        "id": 123,
                        "url": "https://www.pexels.com/video/123/",
                        "image": "https://images.pexels.com/videos/123.jpeg",
                        "duration": 14,
                        "video_files": [
                            {
                                "link": "https://cdn.pexels.com/videos/123_large.mp4",
                                "width": 1920,
                                "height": 1080,
                                "quality": "hd",
                            },
                            {
                                "link": "https://cdn.pexels.com/videos/123_small.mp4",
                                "width": 640,
                                "height": 360,
                                "quality": "sd",
                            },
                        ],
                        "user": {"name": "Avery"},
                        "tags": ["drone", "river"],
                    },
                }
            ]
        }
    )

    asyncio.run(step.run(context))

    asset = context.data["assets"][0]
    assert asset["id"] == "pexels_123"
    assert asset["source_asset_id"] == "123"
    assert asset["video_url"] == "https://cdn.pexels.com/videos/123_large.mp4"
    assert asset["thumbnail_url"] == "https://images.pexels.com/videos/123.jpeg"
    assert asset["license"] == "Pexels License"
    assert asset["creator"] == "Avery"
    assert asset["tags"] == ["drone", "river"]


def test_discover_asset_step_allows_empty_successful_results() -> None:
    step = DiscoverAssetStep(
        pexels_client=FakeSourceClient([]),
        pixabay_client=FakeSourceClient([]),
    )
    context = PipelineContext(data={"query": "cinematic drone shot"})

    asyncio.run(step.run(context))

    assert context.data["raw_assets"] == []
    assert context.data["discovered_assets_count"] == 0


def test_fetch_asset_metadata_step_normalizes_pixabay_payload() -> None:
    repository = InMemoryBrollAssetRepository()
    step = FetchAssetMetadataStep(repository=repository)
    context = PipelineContext(
        data={
            "raw_assets": [
                {
                    "source": "pixabay",
                    "payload": {
                        "id": 987,
                        "pageURL": "https://pixabay.com/videos/id-987/",
                        "tags": "city, skyline, night",
                        "duration": 20,
                        "videos": {
                            "medium": {
                                "url": "https://cdn.pixabay.com/videos/987_medium.mp4"
                            }
                        },
                        "picture_id": "567890",
                        "user": "Riley",
                    },
                }
            ]
        }
    )

    asyncio.run(step.run(context))

    asset = context.data["assets"][0]
    assert asset["id"] == "pixabay_987"
    assert asset["source_asset_id"] == "987"
    assert asset["video_url"] == "https://cdn.pixabay.com/videos/987_medium.mp4"
    assert (
        asset["thumbnail_url"]
        == "https://i.vimeocdn.com/video/567890_640x360.jpg"
    )
    assert asset["license"] == "Pixabay License"
    assert asset["creator"] == "Riley"
    assert asset["tags"] == ["city", "skyline", "night"]


def test_generate_clip_embedding_step_produces_expected_dimension() -> None:
    step = GenerateClipEmbeddingStep(embedding_backend=FakeEmbeddingBackend())
    context = PipelineContext(
        data={
            "assets": [{"id": "pexels_123"}],
            "frame_paths": {"pexels_123": "/tmp/frame.jpg"},
        }
    )

    asyncio.run(step.run(context))

    vector = context.data["embeddings"]["pexels_123"]
    assert len(vector) == 512
    assert context.data["embedding_dimension"] == 512
