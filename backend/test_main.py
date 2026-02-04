import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
from main import app, build_prompt, parse_llm_response

client = TestClient(app)

MOCK_RESPONSE = '{"downgraded": "这个产品还行", "hype_score": 8}'
MOCK_RESPONSE_EN = '{"downgraded": "This product is okay", "hype_score": 7}'


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == "title-downgrader"


def test_empty_title():
    r = client.post("/api/downgrade", json={"title": "", "intensity": "normal"})
    assert r.status_code == 400


def test_whitespace_title():
    r = client.post("/api/downgrade", json={"title": "   ", "intensity": "normal"})
    assert r.status_code == 400


def test_invalid_intensity():
    r = client.post("/api/downgrade", json={"title": "test", "intensity": "xxx"})
    assert r.status_code == 422


def test_invalid_language():
    r = client.post("/api/downgrade", json={"title": "test", "intensity": "normal", "language": "xx"})
    assert r.status_code == 422


def test_missing_fields():
    r = client.post("/api/downgrade", json={})
    assert r.status_code == 422


@patch('main.call_llm', new_callable=AsyncMock)
def test_success_zh(mock_llm):
    mock_llm.return_value = MOCK_RESPONSE
    r = client.post("/api/downgrade", json={"title": "这个产品改变了我的人生！", "intensity": "normal", "language": "zh"})
    assert r.status_code == 200
    d = r.json()
    assert d["original"] == "这个产品改变了我的人生！"
    assert d["downgraded"] == "这个产品还行"
    assert d["hype_score"] == 8
    assert d["intensity"] == "normal"


@patch('main.call_llm', new_callable=AsyncMock)
def test_success_en(mock_llm):
    mock_llm.return_value = MOCK_RESPONSE_EN
    r = client.post("/api/downgrade", json={"title": "This changed my life!", "intensity": "brutal", "language": "en"})
    assert r.status_code == 200
    assert r.json()["language"] == "en"


@patch('main.call_llm', new_callable=AsyncMock)
def test_default_values(mock_llm):
    mock_llm.return_value = MOCK_RESPONSE_EN
    r = client.post("/api/downgrade", json={"title": "Amazing!"})
    assert r.status_code == 200
    d = r.json()
    assert d["intensity"] == "normal"
    assert d["language"] == "en"


@patch('main.call_llm', new_callable=AsyncMock)
def test_all_intensities(mock_llm):
    mock_llm.return_value = MOCK_RESPONSE
    for i in ["mild", "normal", "brutal"]:
        r = client.post("/api/downgrade", json={"title": "Wow!", "intensity": i, "language": "zh"})
        assert r.status_code == 200


@patch('main.call_llm', new_callable=AsyncMock)
def test_all_languages(mock_llm):
    mock_llm.return_value = MOCK_RESPONSE_EN
    for lang in ["en", "zh", "ja", "de", "fr", "ko", "es"]:
        r = client.post("/api/downgrade", json={"title": "Wow!", "intensity": "normal", "language": lang})
        assert r.status_code == 200


@patch('main.call_llm', new_callable=AsyncMock)
def test_hype_score_clamped(mock_llm):
    mock_llm.return_value = '{"downgraded": "meh", "hype_score": 15}'
    r = client.post("/api/downgrade", json={"title": "Test!", "intensity": "normal"})
    assert r.status_code == 200
    assert r.json()["hype_score"] == 10

    mock_llm.return_value = '{"downgraded": "meh", "hype_score": 0}'
    r = client.post("/api/downgrade", json={"title": "Test!", "intensity": "normal"})
    assert r.json()["hype_score"] == 1


@patch('main.call_llm', new_callable=AsyncMock)
def test_llm_failure(mock_llm):
    from fastapi import HTTPException
    mock_llm.side_effect = HTTPException(status_code=500, detail="AI 生成失败: timeout")
    r = client.post("/api/downgrade", json={"title": "Test", "intensity": "normal"})
    assert r.status_code == 500


@patch('main.call_llm', new_callable=AsyncMock)
def test_parse_failure(mock_llm):
    mock_llm.return_value = "not json"
    r = client.post("/api/downgrade", json={"title": "Test", "intensity": "normal"})
    assert r.status_code == 500


@patch('main.call_llm', new_callable=AsyncMock)
def test_strips_whitespace(mock_llm):
    mock_llm.return_value = MOCK_RESPONSE_EN
    r = client.post("/api/downgrade", json={"title": "  Test!  ", "intensity": "normal"})
    assert r.json()["original"] == "Test!"


# ===== build_prompt tests =====

def test_prompt_zh():
    p = build_prompt("夸张标题", "normal", "zh")
    assert "夸张标题" in p
    assert "说人话" in p


def test_prompt_en():
    p = build_prompt("Hype title", "brutal", "en")
    assert "Hype title" in p
    assert "brutal" in p


def test_prompt_all_intensities():
    for i in ["mild", "normal", "brutal"]:
        p = build_prompt("test", i, "zh")
        assert len(p) > 50
        p = build_prompt("test", i, "en")
        assert len(p) > 50


# ===== parse_llm_response tests =====

def test_parse_valid():
    r = parse_llm_response('{"downgraded": "ok", "hype_score": 5}')
    assert r["downgraded"] == "ok"
    assert r["hype_score"] == 5


def test_parse_code_block():
    r = parse_llm_response('```json\n{"downgraded": "ok", "hype_score": 5}\n```')
    assert r["downgraded"] == "ok"


def test_parse_regex_fallback():
    r = parse_llm_response('{"downgraded": "ok", "hype_score": 5,}')
    assert r["downgraded"] == "ok"


def test_parse_invalid():
    with pytest.raises(ValueError):
        parse_llm_response("garbage")


# ===== call_llm tests =====

@pytest.mark.asyncio
async def test_call_llm_success():
    from main import call_llm
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"choices": [{"message": {"content": "test"}}]}

    with patch('main.httpx.AsyncClient') as cls:
        mc = AsyncMock()
        mc.post.return_value = mock_resp
        mc.__aenter__ = AsyncMock(return_value=mc)
        mc.__aexit__ = AsyncMock(return_value=False)
        cls.return_value = mc
        assert await call_llm("p") == "test"


@pytest.mark.asyncio
async def test_call_llm_error():
    from main import call_llm
    from fastapi import HTTPException
    with patch('main.httpx.AsyncClient') as cls:
        mc = AsyncMock()
        mc.post.side_effect = Exception("fail")
        mc.__aenter__ = AsyncMock(return_value=mc)
        mc.__aexit__ = AsyncMock(return_value=False)
        cls.return_value = mc
        with pytest.raises(HTTPException):
            await call_llm("p")


def test_app_meta():
    assert app.title == "AI 标题降级器"
