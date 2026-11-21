"""Websocket API the card uses: list, add, cancel and subscribe."""

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
import voluptuous as vol

from .const import DOMAIN, SOURCE_CARD, WS_ADD, WS_CANCEL, WS_LIST, WS_SUBSCRIBE
from .schedules import ScheduleChange, Schedules
from .schema import ADD_FIELDS, ADD_SCHEMA


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    """Register the `later/*` commands."""
    websocket_api.async_register_command(hass, websocket_list)
    websocket_api.async_register_command(hass, websocket_add)
    websocket_api.async_register_command(hass, websocket_cancel)
    websocket_api.async_register_command(hass, websocket_subscribe)


def _loaded(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg_id: int
) -> Schedules | None:
    """The runtime of the loaded Later entry; sends `not_loaded` when there is none."""
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    if not entries:
        connection.send_error(
            msg_id, "not_loaded", "The Later integration is installed but not set up"
        )
        return None
    schedules: Schedules = entries[0].runtime_data
    return schedules


@websocket_api.websocket_command({vol.Required("type"): WS_LIST})
@callback
def websocket_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """All pending schedules, soonest first."""
    if schedules := _loaded(hass, connection, msg["id"]):
        connection.send_result(msg["id"], schedules.list())


@websocket_api.websocket_command({vol.Required("type"): WS_ADD, **ADD_FIELDS})
@websocket_api.async_response
async def websocket_add(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Create a schedule; same fields as the `later.add` service."""
    if not (schedules := _loaded(hass, connection, msg["id"])):
        return
    request = {key: value for key, value in msg.items() if key not in ("id", "type")}
    try:
        validated = ADD_SCHEMA(request)
    except vol.Invalid as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    try:
        schedule = await schedules.async_create(validated, source=SOURCE_CARD)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], websocket_api.ERR_INVALID_FORMAT, str(err))
        return
    connection.send_result(msg["id"], schedule)


@websocket_api.websocket_command(
    {vol.Required("type"): WS_CANCEL, vol.Required("schedule_id"): str}
)
@websocket_api.async_response
async def websocket_cancel(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Delete a schedule without running it (`schedule_id`: `id` is the message id)."""
    if not (schedules := _loaded(hass, connection, msg["id"])):
        return
    try:
        schedule = await schedules.async_cancel(msg["schedule_id"])
    except HomeAssistantError as err:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, str(err))
        return
    connection.send_result(msg["id"], schedule)


@websocket_api.websocket_command({vol.Required("type"): WS_SUBSCRIBE})
@callback
def websocket_subscribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Push the pending list now and after every change, until the socket closes."""
    if not (schedules := _loaded(hass, connection, msg["id"])):
        return

    @callback
    def forward(change: ScheduleChange) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], change))

    connection.subscriptions[msg["id"]] = schedules.async_subscribe(forward)
    connection.send_result(msg["id"])
    connection.send_message(
        websocket_api.event_message(
            msg["id"], {"type": "list", "schedules": schedules.list()}
        )
    )
