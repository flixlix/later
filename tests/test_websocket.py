"""The websocket API the card uses."""

from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_mock_service,
)
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

type Advance = Callable[[timedelta | datetime], Awaitable[None]]
type Setup = Callable[[], Awaitable[MockConfigEntry]]


@pytest.fixture(autouse=True)
def frozen(freezer: FrozenDateTimeFactory) -> None:
    """Start every test at a fixed moment."""
    freezer.move_to(datetime(2026, 11, 21, 18, 0, tzinfo=dt_util.UTC))


async def test_add_list_cancel(
    hass: HomeAssistant, setup_later: Setup, hass_ws_client: WebSocketGenerator
) -> None:
    """The card adds, lists and cancels schedules over the websocket."""
    await setup_later()
    client = await hass_ws_client(hass)

    await client.send_json_auto_id(
        {
            "type": "later/add",
            "entity_id": "switch.heater",
            "action": "turn_off",
            "in": 15,
        }
    )
    added = await client.receive_json()
    assert added["success"], added
    schedule = added["result"]
    assert schedule["source"] == "card"
    assert schedule["service"] == "switch.turn_off"

    await client.send_json_auto_id({"type": "later/list"})
    assert (await client.receive_json())["result"] == [schedule]

    await client.send_json_auto_id(
        {"type": "later/cancel", "schedule_id": schedule["id"]}
    )
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "later/list"})
    assert (await client.receive_json())["result"] == []


async def test_add_rejects_invalid_payload(
    hass: HomeAssistant, setup_later: Setup, hass_ws_client: WebSocketGenerator
) -> None:
    """Both `at` and `in` is an invalid_format error."""
    await setup_later()
    client = await hass_ws_client(hass)

    await client.send_json_auto_id(
        {"type": "later/add", "service": "switch.turn_off", "at": "20:00", "in": 5}
    )
    response = await client.receive_json()

    assert not response["success"]
    assert response["error"]["code"] == "invalid_format"


async def test_cancel_unknown_id(
    hass: HomeAssistant, setup_later: Setup, hass_ws_client: WebSocketGenerator
) -> None:
    """Cancelling an unknown id is not_found."""
    await setup_later()
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "later/cancel", "schedule_id": "nope"})
    response = await client.receive_json()

    assert response["error"]["code"] == "not_found"


@pytest.mark.usefixtures("time_zone")
async def test_update_replaces_action_and_due_time(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Editing keeps the id, moves the timer and renames a default-named schedule."""
    await setup_later()
    turn_on = async_mock_service(hass, "switch", "turn_on")
    turn_off = async_mock_service(hass, "switch", "turn_off")
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "later/add",
            "entity_id": "switch.heater",
            "action": "turn_off",
            "in": 5,
        }
    )
    original = (await client.receive_json())["result"]

    await client.send_json_auto_id(
        {
            "type": "later/update",
            "schedule_id": original["id"],
            "entity_id": "switch.heater",
            "action": "turn_on",
            "at": "2026-11-22 07:30",
        }
    )
    response = await client.receive_json()
    assert response["success"], response
    updated = response["result"]

    assert updated["id"] == original["id"]
    assert updated["created_at"] == original["created_at"]
    assert updated["service"] == "switch.turn_on"
    assert updated["run_at"] == "2026-11-22T06:30:00+00:00"
    assert updated["name"] == "switch.heater: turn on at 07:30"
    await client.send_json_auto_id({"type": "later/list"})
    assert (await client.receive_json())["result"] == [updated]

    await advance(timedelta(minutes=10))
    assert turn_off == []
    await advance(datetime(2026, 11, 22, 6, 30, 1, tzinfo=dt_util.UTC))
    assert len(turn_on) == 1


async def test_update_keeps_a_picked_name(
    hass: HomeAssistant, setup_later: Setup, hass_ws_client: WebSocketGenerator
) -> None:
    """A name someone picked survives an edit that sends no name."""
    await setup_later()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "later/add", "service": "script.bedtime", "in": 5, "name": "Bedtime"}
    )
    original = (await client.receive_json())["result"]

    await client.send_json_auto_id(
        {
            "type": "later/update",
            "schedule_id": original["id"],
            "service": "script.bedtime",
            "in": 30,
        }
    )

    assert (await client.receive_json())["result"]["name"] == "Bedtime"


async def test_update_unknown_id(
    hass: HomeAssistant, setup_later: Setup, hass_ws_client: WebSocketGenerator
) -> None:
    """Editing a schedule that already ran or was cancelled is not_found."""
    await setup_later()
    client = await hass_ws_client(hass)

    await client.send_json_auto_id(
        {"type": "later/update", "schedule_id": "gone", "service": "a.b", "in": 5}
    )

    response = await client.receive_json()
    assert not response["success"]
    assert response["error"]["code"] == "not_found"


async def test_subscribe_pushes_every_change(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Subscribers get the list at once, then created, cancelled and ran events."""
    await setup_later()
    async_mock_service(hass, "switch", "turn_off")
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "later/subscribe"})
    assert (await client.receive_json())["success"]
    assert (await client.receive_json())["event"] == {"type": "list", "schedules": []}

    await hass.services.async_call(
        "later",
        "add",
        {"entity_id": "switch.a", "action": "turn_off", "in": 1},
        blocking=True,
    )
    created = (await client.receive_json())["event"]
    await hass.services.async_call(
        "later",
        "add",
        {"entity_id": "switch.b", "action": "turn_off", "in": 5},
        blocking=True,
    )
    second = (await client.receive_json())["event"]
    await hass.services.async_call(
        "later", "cancel", {"id": second["schedule"]["id"]}, blocking=True
    )
    cancelled = (await client.receive_json())["event"]
    await advance(timedelta(minutes=1))
    ran = (await client.receive_json())["event"]

    assert created["type"] == "created"
    assert created["schedules"] == [created["schedule"]]
    assert cancelled["type"] == "cancelled"
    assert cancelled["schedules"] == [created["schedule"]]
    assert ran["type"] == "ran"
    assert ran["schedule"]["id"] == created["schedule"]["id"]
    assert ran["schedules"] == []


async def test_failed_run_is_pushed_as_failed(
    hass: HomeAssistant,
    setup_later: Setup,
    advance: Advance,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """A run whose service is missing is pushed as failed."""
    await setup_later()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "later/subscribe"})
    await client.receive_json()
    await client.receive_json()
    await hass.services.async_call(
        "later", "add", {"service": "nothing.here", "in": 1}, blocking=True
    )
    await client.receive_json()

    await advance(timedelta(minutes=1))

    assert (await client.receive_json())["event"]["type"] == "failed"


async def test_commands_report_not_loaded(
    hass: HomeAssistant, setup_later: Setup, hass_ws_client: WebSocketGenerator
) -> None:
    """With the entry unloaded the card gets not_loaded, which it shows as an error."""
    entry = await setup_later()
    await hass.config_entries.async_unload(entry.entry_id)
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "later/subscribe"})
    response = await client.receive_json()

    assert response["error"]["code"] == "not_loaded"
