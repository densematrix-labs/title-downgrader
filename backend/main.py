from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from prometheus_fastapi_instrumentator import Instrumentator
import httpx
import json
import re
import logging
from typing import Literal, Optional
from datetime import datetime

from app.core.config import settings
from app.core.database import get_db, init_db
from app.models import GenerationToken, FreeTrialTracking
from app.api.payment import router as payment_router
from app.api.tokens import router as tokens_router
from metrics import record_generation, record_token_consumed, generation_timer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database tables on startup."""
    await init_db()
    yield


app = FastAPI(title="AI 标题降级器", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register payment and token routers under /api
app.include_router(payment_router, prefix="/api")
app.include_router(tokens_router, prefix="/api")

# Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/api/metrics")


IntensityType = Literal["mild", "normal", "brutal"]
LangType = Literal["en", "zh", "ja", "de", "fr", "ko", "es"]


class DowngradeRequest(BaseModel):
    title: str
    intensity: IntensityType = "normal"
    language: LangType = "en"
    device_id: Optional[str] = None
    token: Optional[str] = None


class DowngradeResponse(BaseModel):
    original: str
    downgraded: str
    hype_score: int  # 1-10, how exaggerated the original is
    intensity: str
    language: str


class TrialStatusResponse(BaseModel):
    has_free_trial: bool
    uses_remaining: int


INTENSITY_ZH = {
    "mild": "温和降级，保留一点体面",
    "normal": "正常降级，说人话",
    "brutal": "暴力降级，极度平淡，甚至有点丧",
}

INTENSITY_EN = {
    "mild": "gentle downgrade, still somewhat positive",
    "normal": "normal downgrade, just say it plainly",
    "brutal": "brutal downgrade, extremely mundane, borderline depressing",
}


async def call_llm(prompt: str) -> str:
    """调用 LLM 代理"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.LLM_PROXY_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.LLM_PROXY_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 500,
                    "temperature": 0.8,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"LLM API 调用失败: {e}")
        raise HTTPException(status_code=500, detail=f"AI 生成失败: {str(e)}")


def build_prompt(title: str, intensity: IntensityType, language: LangType) -> str:
    if language == "en":
        desc = INTENSITY_EN[intensity]
        return f"""You are a title downgrader. Take exaggerated, clickbait, or marketing titles and rewrite them to be plain, honest, and mundane.

Intensity: {desc}

Exaggerated title: "{title}"

Respond in this EXACT JSON format (no markdown, no code blocks):
{{"downgraded": "the plain version", "hype_score": 7}}

hype_score = how exaggerated the original is (1=normal, 10=absurdly hyped).
Make the downgraded version funny by being aggressively ordinary."""
    else:
        desc = INTENSITY_ZH[intensity]
        return f"""你是一个标题降级器。把夸张的标题/营销文案/点击诱饵还原成平实、诚实、甚至有点无聊的描述。

降级强度：{desc}

夸张标题："{title}"

请严格按以下 JSON 格式回答（不要 markdown，不要代码块）：
{{"downgraded": "平实版本", "hype_score": 7}}

hype_score = 原标题的夸张程度（1=正常, 10=极度夸张）。
降级版本要通过极度平淡来制造反差幽默。"""


def parse_llm_response(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    try:
        data = json.loads(text)
        if "downgraded" in data and "hype_score" in data:
            return data
    except json.JSONDecodeError:
        pass

    down_match = re.search(r'"downgraded"\s*:\s*"([^"]*(?:\\.[^"]*)*)"', text)
    score_match = re.search(r'"hype_score"\s*:\s*(\d+)', text)

    if down_match and score_match:
        return {
            "downgraded": down_match.group(1).replace('\\"', '"'),
            "hype_score": int(score_match.group(1)),
        }

    raise ValueError(f"无法解析 LLM 返回: {text[:200]}")


async def check_and_use_free_trial(device_id: str, db: AsyncSession) -> bool:
    """Check if device has free trial remaining. If so, consume one use. Returns True if allowed."""
    if not device_id:
        return False

    result = await db.execute(
        select(FreeTrialTracking).where(FreeTrialTracking.device_id == device_id)
    )
    tracking = result.scalar_one_or_none()

    if tracking is None:
        # First use — create tracking and allow
        tracking = FreeTrialTracking(device_id=device_id, uses_count=1)
        db.add(tracking)
        await db.commit()
        return True
    elif tracking.uses_count < settings.FREE_TRIAL_LIMIT:
        tracking.uses_count += 1
        await db.commit()
        return True
    else:
        return False


async def check_and_use_token(token_str: str, db: AsyncSession) -> bool:
    """Validate token and consume one generation. Returns True if successful."""
    if not token_str:
        return False

    result = await db.execute(
        select(GenerationToken).where(GenerationToken.token == token_str)
    )
    token_obj = result.scalar_one_or_none()

    if token_obj and token_obj.use_generation():
        await db.commit()
        return True
    return False


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "title-downgrader"}


@app.get("/api/trial-status/{device_id}", response_model=TrialStatusResponse)
async def get_trial_status(device_id: str, db: AsyncSession = Depends(get_db)):
    """Check free trial status for a device."""
    result = await db.execute(
        select(FreeTrialTracking).where(FreeTrialTracking.device_id == device_id)
    )
    tracking = result.scalar_one_or_none()

    if tracking is None:
        return TrialStatusResponse(has_free_trial=True, uses_remaining=settings.FREE_TRIAL_LIMIT)
    else:
        remaining = max(0, settings.FREE_TRIAL_LIMIT - tracking.uses_count)
        return TrialStatusResponse(has_free_trial=remaining > 0, uses_remaining=remaining)


@app.post("/api/downgrade", response_model=DowngradeResponse)
async def downgrade_title(request: DowngradeRequest, db: AsyncSession = Depends(get_db)):
    if not request.title or not request.title.strip():
        raise HTTPException(status_code=400, detail="标题不能为空")

    # 1. Try paid token first
    if request.token:
        if await check_and_use_token(request.token, db):
            pass  # Authorized via token
        else:
            raise HTTPException(
                status_code=402,
                detail="Token is invalid, expired, or has no remaining generations"
            )
    # 2. Try free trial
    elif request.device_id:
        if not await check_and_use_free_trial(request.device_id, db):
            raise HTTPException(
                status_code=402,
                detail="Free trial exhausted. Please purchase credits to continue."
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Either device_id (for free trial) or token (for paid use) is required"
        )

    try:
        prompt = build_prompt(request.title, request.intensity, request.language)
        raw = await call_llm(prompt)
        parsed = parse_llm_response(raw)

        hype = max(1, min(10, parsed["hype_score"]))

        return DowngradeResponse(
            original=request.title.strip(),
            downgraded=parsed["downgraded"],
            hype_score=hype,
            intensity=request.intensity,
            language=request.language,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"降级失败: {e}")
        raise HTTPException(status_code=500, detail="标题降级时发生错误")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
