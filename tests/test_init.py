"""Setup: the bundled card and the logbook."""

from collections.abc import Callable
from pathlib import Path
from unittest.mock import patch

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.core import Event, HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.later.const import EVENT_RAN
from custom_components.later.logbook import async_describe_events


async def test_card_is_served_and_loaded_on_every_dashboard(
    hass: HomeAssistant, hass_client: ClientSessionGenerator, tmp_path: Path
) -> None:
    """The built card is a static file and an extra frontend module, with the version."""
    card = tmp_path / "later-card.js"
    card.write_text(
        "customElements.define('later-card', class extends HTMLElement {});"
    )
    MockConfigEntry(domain="later").add_to_hass(hass)

    with patch("custom_components.later.CARD_FILE", card):
        assert await async_setup_component(hass, "later", {})
        await hass.async_block_till_done()

    urls = hass.data[DATA_EXTRA_MODULE_URL].urls
    assert any(url.startswith("/later/later-card.js?v=") for url in urls)
    client = await hass_client()
    response = await client.get("/later/later-card.js")
    assert response.status == 200
    assert "later-card" in await response.text()


async def test_missing_card_build_is_a_warning(
    hass: HomeAssistant, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Without the built card the integration still loads and says how to build it."""
    MockConfigEntry(domain="later").add_to_hass(hass)

    with patch("custom_components.later.CARD_FILE", tmp_path / "missing.js"):
        assert await async_setup_component(hass, "later", {})

    assert "pnpm build:integration" in caplog.text


async def test_logbook_describes_runs(hass: HomeAssistant) -> None:
    """Runs show in the logbook under the schedule name, on its target."""
    await hass.config.async_set_time_zone("Europe/Berlin")
    describers: dict[str, Callable[[Event], dict[str, str]]] = {}

    def register(
        domain: str, event_type: str, describe: Callable[[Event], dict[str, str]]
    ) -> None:
        describers[event_type] = describe

    async_describe_events(hass, register)
    base = {
        "id": "a1b2c3d4",
        "name": "Heater off",
        "service": "switch.turn_off",
        "entity_id": "switch.heater",
        "run_at": "2026-11-21T19:00:00+00:00",
        "late": False,
        "success": True,
        "error": None,
    }
    describe = describers[EVENT_RAN]

    assert describe(Event(EVENT_RAN, base)) == {
        "name": "Later: Heater off",
        "message": "ran switch.turn_off",
        "entity_id": "switch.heater",
    }
    assert (
        describe(Event(EVENT_RAN, {**base, "late": True}))["message"]
        == "ran switch.turn_off late; it was due at 2026-11-21 20:00"
    )
    assert (
        describe(Event(EVENT_RAN, {**base, "success": False, "error": "boom"}))[
            "message"
        ]
        == "failed to run switch.turn_off: boom"
    )
