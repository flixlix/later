"""Logbook entries for schedules that ran."""

from collections.abc import Callable
from typing import Any

from homeassistant.components.logbook import (
    LOGBOOK_ENTRY_ENTITY_ID,
    LOGBOOK_ENTRY_MESSAGE,
    LOGBOOK_ENTRY_NAME,
)
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.util import dt as dt_util

from .const import DOMAIN, EVENT_RAN


def _message(data: dict[str, Any]) -> str:
    if not data["success"]:
        return f"failed to run {data['service']}: {data['error']}"
    if data["late"]:
        due = dt_util.parse_datetime(data["run_at"], raise_on_error=True)
        return f"ran {data['service']} late; it was due at {dt_util.as_local(due):%Y-%m-%d %H:%M}"
    return f"ran {data['service']}"


@callback
def async_describe_events(
    hass: HomeAssistant,
    async_describe_event: Callable[[str, str, Callable[[Event], dict[str, str]]], None],
) -> None:
    """Describe `later_ran` events."""

    @callback
    def describe(event: Event) -> dict[str, str]:
        entry = {
            LOGBOOK_ENTRY_NAME: f"Later: {event.data['name']}",
            LOGBOOK_ENTRY_MESSAGE: _message(event.data),
        }
        if entity_id := event.data.get("entity_id"):
            entry[LOGBOOK_ENTRY_ENTITY_ID] = entity_id
        return entry

    async_describe_event(DOMAIN, EVENT_RAN, describe)
