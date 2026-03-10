from workers.broll.repository import BrollAssetRepository
from workers.common.pipeline import PipelineContext, PipelineStep


class MarkJobCompletedStep(PipelineStep):
    step_name = "MarkJobCompletedStep"

    def __init__(self, repository: BrollAssetRepository | None = None) -> None:
        self._repository = repository

    async def _process(self, context: PipelineContext) -> None:
        repository = self._repository or context.conf.get("repository")
        artifacts = {
            "discovered_assets_count": context.data.get("discovered_assets_count", 0),
            "new_assets_count": context.data.get("new_assets_count", 0),
            "indexed_assets_count": context.data.get("indexed_assets_count", 0),
            "temp_dir": context.data.get("temp_dir"),
        }

        context.data["job_status"] = "completed"
        context.data["job_artifacts"] = artifacts

        if repository is not None:
            await repository.mark_job_completed(
                job_id=context.data.get("job_id"),
                artifacts=artifacts,
            )
