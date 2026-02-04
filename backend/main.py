from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import json
import re
import logging
from typing import Literal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI 标题降级器", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LLM_PROXY_URL = "https://llm-proxy.densematrix.ai"
LLM_PROXY_KEY = "sk-wskhgeyawc"
LLM_MODEL = "gemini-2.5-flash"

IntensityType = Literal["mild", "normal", "brutal"]
LangType = Literal["en", "zh", "ja", "de", "fr", "ko", "es"]


class DowngradeRequest(BaseModel):
    title: str
    intensity: IntensityType = "normal"
    language: LangType = "en"


class DowngradeResponse(BaseModel):
    original: str
    downgraded: str
    hype_score: int  # 1-10, how exaggerated the original is
    intensity: str
    language: str


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
                f"{LLM_PROXY_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_PROXY_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL,
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


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "title-downgrader"}


@app.post("/api/downgrade", response_model=DowngradeResponse)
async def downgrade_title(request: DowngradeRequest):
    if not request.title or not request.title.strip():
        raise HTTPException(status_code=400, detail="标题不能为空")

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
