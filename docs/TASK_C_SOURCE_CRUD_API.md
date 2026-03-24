# Task C: Content Source 管理 API

> **Codex Worktree 任务** — 可和 Task A、Task B 并行
> 只改 `backend/` 下的文件

---

## 目标

在 admin API 中新增 Content Source 的 CRUD 端点，让管理员可以通过 API 创建/查看/更新/删除/手动触发发现源。

---

## 当前状态

`backend/app/routers/admin.py` 已有 worker/live、videos、jobs 等端点，但没有 content source 管理。目前只能通过直接插 DB 来管理 sources。

---

## 实现

### 1. 新增 Models

**文件：`backend/app/admin/models.py`**

在文件末尾新增：

```python
from pydantic import BaseModel, Field
from typing import Any, Literal


class CreateSourceRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    track: Literal["unified", "knowledge", "broll"] = "unified"
    display_name: str = Field(min_length=1, max_length=200)
    source_type: Literal["youtube", "youtube_search", "pexels", "pixabay"]
    config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class UpdateSourceRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    config: dict[str, Any] | None = None
    is_active: bool | None = None
    sync_cursor: str | None = None


class AdminSourceResponse(BaseModel):
    id: str
    slug: str
    track: str
    display_name: str
    source_type: str | None
    config: dict[str, Any]
    sync_cursor: str | None
    is_active: bool
    created_at: str
    updated_at: str
    pending_jobs: int = 0
    failed_jobs: int = 0
    last_job_at: str | None = None


class AdminSourceListResponse(BaseModel):
    sources: list[AdminSourceResponse]
    total: int
```

### 2. 新增 Service 函数

**文件：`backend/app/admin/service.py`**（或 `backend/app/admin/__init__.py`，取决于现有结构）

在已有的 admin service 函数旁新增：

```python
import json
from uuid import UUID


async def fetch_sources(db: Any) -> list[dict[str, Any]]:
    """列出所有 content sources，附带 job 统计。"""
    rows = await db.fetch("""
        SELECT
            cs.id, cs.slug, cs.track, cs.display_name,
            cs.source_type, cs.config, cs.sync_cursor,
            cs.is_active, cs.metadata,
            cs.created_at, cs.updated_at,
            count(pj.id) FILTER (WHERE pj.status = 'pending') as pending_jobs,
            count(pj.id) FILTER (WHERE pj.status = 'failed') as failed_jobs,
            max(pj.created_at) as last_job_at
        FROM content_sources cs
        LEFT JOIN processing_jobs pj ON pj.source_id = cs.id
        GROUP BY cs.id
        ORDER BY cs.updated_at DESC
    """)
    result = []
    for r in rows:
        row = dict(r)
        # config 可能在 config 列或 metadata 列
        config = row.get("config") or row.get("metadata") or {}
        if isinstance(config, str):
            config = json.loads(config)
        # source_type 可能在列或 metadata 中
        source_type = row.get("source_type") or (config.get("source_type") if isinstance(config, dict) else None)
        row["config"] = config
        row["source_type"] = source_type
        row["id"] = str(row["id"])
        row["created_at"] = str(row["created_at"])
        row["updated_at"] = str(row["updated_at"])
        row["last_job_at"] = str(row["last_job_at"]) if row.get("last_job_at") else None
        result.append(row)
    return result


async def create_source(db: Any, *, slug: str, track: str, display_name: str,
                        source_type: str, config: dict, is_active: bool) -> dict[str, Any]:
    """创建新的 content source。"""
    row = await db.fetchrow("""
        INSERT INTO content_sources (slug, track, display_name, source_type, config, is_active)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING *
    """, slug, track, display_name, source_type, json.dumps(config), is_active)
    if row is None:
        raise ValueError("Failed to create source.")
    result = dict(row)
    result["id"] = str(result["id"])
    return result


async def update_source(db: Any, *, source_id: str, **updates) -> dict[str, Any] | None:
    """更新 source 的指定字段。"""
    # 构建动态 UPDATE
    set_clauses = []
    params = []
    param_idx = 1

    for field in ("display_name", "config", "is_active", "sync_cursor"):
        if field in updates and updates[field] is not None:
            value = updates[field]
            if field == "config":
                set_clauses.append(f"config = ${param_idx}::jsonb")
                params.append(json.dumps(value))
            else:
                set_clauses.append(f"{field} = ${param_idx}")
                params.append(value)
            param_idx += 1

    if not set_clauses:
        return None

    set_clauses.append(f"updated_at = NOW()")
    params.append(source_id)

    query = f"""
        UPDATE content_sources
        SET {', '.join(set_clauses)}
        WHERE id = ${param_idx}::uuid
        RETURNING *
    """
    row = await db.fetchrow(query, *params)
    if row is None:
        return None
    result = dict(row)
    result["id"] = str(result["id"])
    return result


async def delete_source(db: Any, *, source_id: str) -> bool:
    """删除 source。关联的 jobs 的 source_id 会被 SET NULL。"""
    result = await db.execute("""
        DELETE FROM content_sources WHERE id = $1::uuid
    """, source_id)
    return "DELETE 1" in result
```

### 3. 新增路由端点

**文件：`backend/app/routers/admin.py`**

在文件末尾（现有端点之后）新增：

```python
from app.admin.models import (
    CreateSourceRequest,
    UpdateSourceRequest,
    AdminSourceListResponse,
)
from app.admin import (  # 或者从 service.py import
    fetch_sources,
    create_source as create_source_fn,
    update_source as update_source_fn,
    delete_source as delete_source_fn,
)


@router.get("/sources")
async def list_sources(
    session: SessionContext = Depends(require_session),
    db: Any = Depends(get_db),
) -> dict[str, object]:
    await require_admin_access(session, db)
    sources = await fetch_sources(db)
    return {"sources": sources, "total": len(sources)}


@router.post("/sources", status_code=status.HTTP_201_CREATED)
async def create_source_endpoint(
    body: CreateSourceRequest,
    session: SessionContext = Depends(require_session),
    db: Any = Depends(get_db),
) -> dict[str, object]:
    await require_admin_access(session, db)
    try:
        source = await create_source_fn(
            db,
            slug=body.slug,
            track=body.track,
            display_name=body.display_name,
            source_type=body.source_type,
            config=body.config,
            is_active=body.is_active,
        )
    except Exception as exc:
        if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Source with slug '{body.slug}' already exists.",
            ) from exc
        raise
    return source


@router.patch("/sources/{source_id}")
async def update_source_endpoint(
    source_id: UUID,
    body: UpdateSourceRequest,
    session: SessionContext = Depends(require_session),
    db: Any = Depends(get_db),
) -> dict[str, object]:
    await require_admin_access(session, db)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )
    result = await update_source_fn(db, source_id=str(source_id), **updates)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source not found.",
        )
    return result


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source_endpoint(
    source_id: UUID,
    session: SessionContext = Depends(require_session),
    db: Any = Depends(get_db),
) -> Response:
    await require_admin_access(session, db)
    deleted = await delete_source_fn(db, source_id=str(source_id))
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source not found.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

### 4. 注意导入

确保从 `app.admin` 或 `app.admin.service` 正确导入新的函数。检查 `backend/app/admin/__init__.py` 的 export 结构，按现有 pattern 添加新函数的导出。

---

## 验证

```bash
pytest backend/tests -q
```

手动验证（启动服务后）：

```bash
# 列出 sources
curl -s http://127.0.0.1:8000/admin/sources \
  -H "Cookie: <admin-session>" | jq

# 创建 source
curl -s -X POST http://127.0.0.1:8000/admin/sources \
  -H "Cookie: <admin-session>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-channel",
    "track": "unified",
    "display_name": "Test Channel",
    "source_type": "youtube",
    "config": {"channel_id": "UC123", "max_results": 25}
  }' | jq

# 更新 source
curl -s -X PATCH http://127.0.0.1:8000/admin/sources/<UUID> \
  -H "Cookie: <admin-session>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}' | jq

# 删除 source
curl -s -X DELETE http://127.0.0.1:8000/admin/sources/<UUID> \
  -H "Cookie: <admin-session>"
```

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `backend/app/admin/models.py` | 新增 CreateSourceRequest, UpdateSourceRequest, AdminSourceResponse |
| `backend/app/admin/service.py` 或 `__init__.py` | 新增 fetch_sources, create_source, update_source, delete_source |
| `backend/app/routers/admin.py` | 新增 5 个 /admin/sources 端点 |
