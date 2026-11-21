"""Schedules survive restarts; missed ones run once, late, after startup."""

from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from typing import Any

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_capture_events,
    async_mock_service,
)

from custom_components.later.const import EVENT_RAN, STARTUP_DELAY

from .common import add, stored

type Advance = Callable[[timedelta | datetime], Awaitable[None]]
type Setup = Callable[[], Awaitable[MockConfigEntry]]

NOW = datetime(2026, 11, 21, 18, 0, tzinfo=dt_util.UTC)


@pytest.fixture(autouse=True)
def frozen(freezer: FrozenDateTimeFactory) -> None:
    """Start every test at NOW."""
    freezer.move_to(NOW)


def stored_schedule(run_at: datetime, schedule_id: str = "a1b2c3d4") -> dict[str, Any]:
    """A schedule as an earlier run of Home Assistant wrote it."""
    return {
        "id": schedule_id,
        "name": "Heater off",
        "run_at": run_at.isoformat(),
        "created_at": (run_at - timedelta(hours=1)).isoformat(),
        "service": "switch.turn_off",
        "data": {},
        "entity_id": "switch.heater",
        "source": "card",
    }


def write_storage(hass_storage: dict[str, Any], *schedules: dict[str, Any]) -> None:
    """Put schedules in `.storage/later.storage` before Later starts."""
    hass_storage["later.storage"] = {
        "version": 1,
        "minor_version": 1,
        "key": "later.storage",
        "data": {"schedules": list(schedules)},
    }


async def test_pending_schedule_survives_a_restart_and_keeps_its_time(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_storage: dict[str, Any],
) -> None:
    """After a reload the schedule is still pending and runs at its original due time."""
    entry = await setup_later()
    calls = async_mock_service(hass, "switch", "turn_off")
    schedule = await add(
        hass, entity_id="switch.heater", action="turn_off", **{"in": 30}
    )

    await advance(timedelta(minutes=5))
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert stored(hass_storage) == [schedule]

    await advance(timedelta(minutes=20))
    assert calls == []
    await advance(dt_util.parse_datetime(schedule["run_at"], raise_on_error=True))

    assert len(calls) == 1
    assert stored(hass_storage) == []


async def test_future_schedule_from_storage_is_armed(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_storage: dict[str, Any],
) -> None:
    """A stored schedule due later is armed at startup, not run."""
    write_storage(hass_storage, stored_schedule(NOW + timedelta(hours=2)))
    calls = async_mock_service(hass, "switch", "turn_off")

    await setup_later()
    assert calls == []

    await advance(NOW + timedelta(hours=2))
    assert len(calls) == 1


async def test_missed_schedule_runs_once_late_after_startup(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_storage: dict[str, Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Due while Home Assistant was down: runs once after the startup delay, logged late."""
    write_storage(hass_storage, stored_schedule(NOW - timedelta(minutes=30)))
    calls = async_mock_service(hass, "switch", "turn_off")
    ran = async_capture_events(hass, EVENT_RAN)
    entry = MockConfigEntry(domain="later")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    await advance(STARTUP_DELAY - timedelta(seconds=1))
    assert calls == []

    await advance(timedelta(seconds=2))
    await advance(timedelta(hours=1))

    assert len(calls) == 1
    assert calls[0].data == {"entity_id": "switch.heater"}
    assert stored(hass_storage) == []
    assert len(ran) == 1
    assert ran[0].data["late"] is True
    assert "Schedule a1b2c3d4 (Heater off) was due at" in caplog.text
    assert "runs late" in caplog.text
