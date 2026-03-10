#!/usr/bin/env python3
import argparse
import asyncio
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from workers.broll import BrollIndexingPipeline, InMemoryBrollAssetRepository


async def _run_pipeline(query: str) -> int:
    repository = InMemoryBrollAssetRepository()
    pipeline = BrollIndexingPipeline(repository=repository)
    context = await pipeline.run(query)

    if context.failed_step is not None:
        print(f"Pipeline failed at {context.failed_step}: {context.error}")
        return 1

    warnings = context.data.get("discovery_warnings", {})
    for source_name, message in warnings.items():
        print(f"Warning [{source_name}]: {message}")

    print(f"Discovered: {context.data.get('discovered_assets_count', 0)}")
    print(f"New: {context.data.get('new_assets_count', 0)}")
    print(f"Indexed: {context.data.get('indexed_assets_count', 0)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Cerul B-roll assets.")
    parser.add_argument("query", help='Search query, e.g. "cinematic drone shot"')
    args = parser.parse_args()
    return asyncio.run(_run_pipeline(args.query))


if __name__ == "__main__":
    raise SystemExit(main())
