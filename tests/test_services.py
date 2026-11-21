"""Creating, cancelling and running schedules through the services."""

from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from typing import Any

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_capture_events,
    async_mock_service,
)
import voluptuous as vol

from custom_components.later.const import DOMAIN, EVENT_RAN

from .common import add, stored

type Advance = Callable[[timedelta | datetime], Awaitable[None]]
type Setup = Callable[[], Awaitable[MockConfigEntry]]

NOW = datetime(2026, 11, 21, 18, 0, tzinfo=dt_util.UTC)  # 19:00 in Berlin


@pytest.fixture(autouse=True)
async def frozen(freezer: FrozenDateTimeFactory, time_zone: None) -> None:
    """Start every test at NOW, in Berlin."""
    freezer.move_to(NOW)


async def test_in_minutes_is_stored_as_a_due_time(
    hass: HomeAssistant, setup_later: Setup, hass_storage: dict[str, Any]
) -> None:
    """`in: 30` becomes an absolute UTC due time, stored right away."""
    await setup_later()
    created_at = dt_util.utcnow().replace(microsecond=0)

    schedule = await add(
        hass, entity_id="switch.heater", action="turn_off", **{"in": 30}
    )

    assert schedule == {
        "id": schedule["id"],
        "name": "switch.heater: turn off at 19:30",
        "run_at": (created_at + timedelta(minutes=30)).isoformat(),
        "created_at": created_at.isoformat(),
        "service": "switch.turn_off",
        "data": {},
        "entity_id": "switch.heater",
        "source": "service",
    }
    assert len(schedule["id"]) == 8
    assert stored(hass_storage) == [schedule]


async def test_clock_time_is_today_or_tomorrow(
    hass: HomeAssistant, setup_later: Setup
) -> None:
    """A clock time is in the Home Assistant time zone, tomorrow once it has passed."""
    await setup_later()

    later_today = await add(hass, service="light.turn_on", at="20:00")
    passed = await add(hass, service="light.turn_on", at="18:30")
    exact = await add(hass, service="light.turn_on", at="2026-12-24 18:00")

    assert later_today["run_at"] == "2026-11-21T19:00:00+00:00"
    assert passed["run_at"] == "2026-11-22T17:30:00+00:00"
    assert exact["run_at"] == "2026-12-24T17:00:00+00:00"


async def test_name_uses_the_friendly_name(
    hass: HomeAssistant, setup_later: Setup
) -> None:
    """A schedule without a name is named after the target, the action and the time."""
    await setup_later()
    hass.states.async_set("climate.office", "heat", {"friendly_name": "Office heater"})

    derived = await add(hass, entity_id="climate.office", action="turn_off", at="20:00")
    named = await add(
        hass,
        entity_id="climate.office",
        action="turn_off",
        at="20:00",
        name="Heater off",
    )

    assert derived["name"] == "Office heater: turn off at 20:00"
    assert named["name"] == "Heater off"


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"service": "switch.turn_off"}, "at"),
        ({"service": "switch.turn_off", "at": "20:00", "in": 5}, "not both"),
        ({"entity_id": "switch.a", "at": "20:00"}, "service"),
        (
            {
                "entity_id": "switch.a",
                "action": "turn_off",
                "service": "switch.toggle",
                "in": 5,
            },
            "not both",
        ),
        ({"action": "turn_off", "in": 5}, "entity_id"),
        ({"entity_id": "switch.a", "action": "open", "in": 5}, "action"),
        ({"service": "switch.turn_off", "in": 0}, "above 0"),
        ({"service": "switch.turn_off", "at": "tonight"}, "at"),
        ({"service": "not a service", "in": 5}, "service"),
    ],
)
async def test_invalid_payloads_are_rejected(
    hass: HomeAssistant,
    setup_later: Setup,
    hass_storage: dict[str, Any],
    data: dict[str, Any],
    message: str,
) -> None:
    """Exactly one of `at`/`in` and one of `service`/`action`; nothing is stored."""
    await setup_later()

    with pytest.raises(vol.Invalid, match=message):
        await add(hass, **data)

    assert "later.storage" not in hass_storage or stored(hass_storage) == []


async def test_due_schedule_runs_once_and_is_deleted(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_storage: dict[str, Any],
) -> None:
    """At its due time the action is called once with the target, then the schedule is gone."""
    await setup_later()
    calls = async_mock_service(hass, "climate", "set_temperature")
    ran = async_capture_events(hass, EVENT_RAN)
    schedule = await add(
        hass,
        entity_id="climate.office",
        service="climate.set_temperature",
        data={"temperature": 17},
        **{"in": 30},
    )

    await advance(timedelta(minutes=29))
    assert calls == []

    await advance(timedelta(minutes=1))
    await advance(timedelta(hours=1))

    assert len(calls) == 1
    assert calls[0].data == {"entity_id": "climate.office", "temperature": 17}
    assert stored(hass_storage) == []
    assert [event.data["id"] for event in ran] == [schedule["id"]]
    assert ran[0].data["late"] is False
    assert ran[0].data["success"] is True


async def test_cancel_deletes_without_running(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_storage: dict[str, Any],
) -> None:
    """A cancelled schedule never runs."""
    await setup_later()
    calls = async_mock_service(hass, "switch", "turn_off")
    schedule = await add(
        hass, entity_id="switch.heater", action="turn_off", **{"in": 5}
    )

    await hass.services.async_call(
        DOMAIN, "cancel", {"id": schedule["id"]}, blocking=True
    )
    await advance(timedelta(minutes=10))

    assert calls == []
    assert stored(hass_storage) == []


async def test_cancel_unknown_id(hass: HomeAssistant, setup_later: Setup) -> None:
    """Cancelling a schedule that is not pending is an error that names the id."""
    await setup_later()

    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "cancel", {"id": "nope"}, blocking=True)

    assert err.value.translation_key == "not_found"
    assert err.value.translation_placeholders == {"id": "nope"}


async def test_run_now(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_storage: dict[str, Any],
) -> None:
    """`run_now` runs the action at once and deletes the schedule; it does not run again."""
    await setup_later()
    calls = async_mock_service(hass, "switch", "turn_off")
    schedule = await add(
        hass, entity_id="switch.heater", action="turn_off", **{"in": 5}
    )

    await hass.services.async_call(
        DOMAIN, "run_now", {"id": schedule["id"]}, blocking=True
    )
    await hass.async_block_till_done()
    await advance(timedelta(minutes=10))

    assert len(calls) == 1
    assert stored(hass_storage) == []


async def test_failed_action_is_logged_and_deleted(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_storage: dict[str, Any],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A missing service is logged with the schedule, which is deleted and not retried."""
    await setup_later()
    ran = async_capture_events(hass, EVENT_RAN)
    schedule = await add(hass, entity_id="switch.gone", action="turn_off", **{"in": 1})

    await advance(timedelta(minutes=1))
    await advance(timedelta(minutes=10))

    assert stored(hass_storage) == []
    assert len(ran) == 1
    assert ran[0].data["success"] is False
    assert "switch.turn_off" in ran[0].data["error"]
    assert f"Schedule {schedule['id']}" in caplog.text
    assert "switch.turn_off on switch.gone" in caplog.text


async def test_services_need_a_loaded_entry(
    hass: HomeAssistant, setup_later: Setup
) -> None:
    """With the entry unloaded the services say Later is not set up."""
    entry = await setup_later()
    await hass.config_entries.async_unload(entry.entry_id)

    with pytest.raises(ServiceValidationError) as err:
        await add(hass, service="switch.turn_off", **{"in": 5})

    assert err.value.translation_key == "not_loaded"
