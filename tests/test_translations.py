"""The integration's translations: every language says everything strings.json says."""

import json
from pathlib import Path
import re
from typing import Any

import pytest

INTEGRATION = Path(__file__).parent.parent / "custom_components" / "later"
CARD_TRANSLATIONS = (
    Path(__file__).parent.parent / "packages" / "later-card" / "src" / "translations"
)
STRINGS = json.loads((INTEGRATION / "strings.json").read_text(encoding="utf-8"))
LANGUAGES = sorted(path.stem for path in (INTEGRATION / "translations").glob("*.json"))


def _strings(node: Any, prefix: str = "") -> dict[str, str]:
    """Every string, by dotted key."""
    if isinstance(node, str):
        return {prefix: node}
    return {
        key: text
        for name, child in node.items()
        for key, text in _strings(child, f"{prefix}.{name}" if prefix else name).items()
    }


def _translation(language: str) -> dict[str, str]:
    path = INTEGRATION / "translations" / f"{language}.json"
    return _strings(json.loads(path.read_text(encoding="utf-8")))


def test_english_is_strings_json() -> None:
    """translations/en.json is what Home Assistant builds from strings.json."""
    assert _translation("en") == _strings(STRINGS)


def test_same_languages_as_the_card() -> None:
    """The integration and the card ship the same languages."""
    assert sorted(path.stem for path in CARD_TRANSLATIONS.glob("*.json")) == LANGUAGES


@pytest.mark.parametrize("language", LANGUAGES)
def test_same_keys_as_strings_json(language: str) -> None:
    """No language misses a string or carries one strings.json no longer has."""
    assert list(_translation(language)) == list(_strings(STRINGS))


@pytest.mark.parametrize("language", LANGUAGES)
def test_keeps_placeholders(language: str) -> None:
    """`{id}` survives translation, so Home Assistant can fill it in."""
    english = _strings(STRINGS)
    for key, text in _translation(language).items():
        assert sorted(re.findall(r"\{\w+\}", text)) == sorted(
            re.findall(r"\{\w+\}", english[key])
        ), key
