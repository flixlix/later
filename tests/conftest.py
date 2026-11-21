"""Fixtures for the Later tests."""

from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
)

from custom_components.later.const import DOMAIN, STARTUP_DELAY


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Let Home Assistant load custom_components/later."""


@pytest.fixture
async def time_zone(hass: HomeAssistant) -> None:
    """Run in Berlin, so local clock times differ from UTC."""
    await hass.config.async_set_time_zone("Europe/Berlin")


@pytest.fixture
def advance(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> Callable[[timedelta | datetime], Awaitable[None]]:
    """Move the clock forward (by a delta, or to a moment) and fire due timers."""

    async def _advance(to: timedelta | datetime) -> None:
        if isinstance(to, timedelta):
            freezer.tick(to)
        else:
            freezer.move_to(to)
        async_fire_time_changed(hass, dt_util.utcnow())
        await hass.async_block_till_done()

    return _advance


@pytest.fixture
def setup_later(
    hass: HomeAssistant, advance: Callable[[timedelta | datetime], Awaitable[None]]
) -> Callable[[], Awaitable[MockConfigEntry]]:
    """Set up Later and let the startup delay pass, as after a restart."""

    async def _setup() -> MockConfigEntry:
        entry = MockConfigEntry(domain=DOMAIN, title="Later")
        entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        await advance(STARTUP_DELAY + timedelta(seconds=1))
        return entry

    return _setup
