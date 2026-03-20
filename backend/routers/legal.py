# filename: routers/legal.py
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "docs")


class LegalDocResponse(BaseModel):
    title: str
    content: str
    effective_date: str


def _read_doc(filename: str) -> str:
    path = os.path.join(_DOCS_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document not found: {filename}")


@router.get("/api/v1/legal/privacy", response_model=LegalDocResponse, tags=["legal"])
async def get_privacy_policy():
    """获取隐私政策"""
    content = _read_doc("PRIVACY_POLICY.md")
    return LegalDocResponse(
        title="Privacy Policy",
        content=content,
        effective_date="2026-03-10",
    )


@router.get("/api/v1/legal/terms", response_model=LegalDocResponse, tags=["legal"])
async def get_terms_of_service():
    """获取服务条款"""
    content = _read_doc("TERMS_OF_SERVICE.md")
    return LegalDocResponse(
        title="Terms of Service",
        content=content,
        effective_date="2026-03-10",
    )
