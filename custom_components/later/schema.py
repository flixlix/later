"""Validation of new schedules, shared by the `later.add` service and `later/add`."""

from datetime import datetime, time, timedelta, tzinfo
from typing import Any

from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util
import voluptuous as vol

from .const import (
    ATTR_ACTION,
    ATTR_AT,
    ATTR_DATA,
    ATTR_ENTITY_ID,
    ATTR_IN,
    ATTR_NAME,
    ATTR_SERVICE,
    SHORTCUTS,
)


def clock_time_or_datetime(value: Any) -> time | datetime:
    """`20:00` (the next 20:00) or a date and time like `2026-11-21 20:00`."""
    if isinstance(value, (datetime, time)):
        return value
    text = str(value).strip()
    parsed = dt_util.parse_datetime(text) or dt_util.parse_time(text)
    if parsed is None:
        raise vol.Invalid(
            f"`at` must be a time (20:00) or a date and time (2026-11-21 20:00), got {value!r}"
        )
    return parsed


def _action_needs_entity(value: dict[str, Any]) -> dict[str, Any]:
    if ATTR_ACTION in value and ATTR_ENTITY_ID not in value:
        raise vol.Invalid("`action` (turn_on, turn_off, toggle) needs an `entity_id`")
    return value


ADD_FIELDS: dict[vol.Marker, Any] = {
    vol.Optional(ATTR_ENTITY_ID): cv.entity_id,
    vol.Exclusive(
        ATTR_SERVICE, "what", msg="send either `service` or `action`, not both"
    ): cv.service,
    vol.Exclusive(
        ATTR_ACTION, "what", msg="send either `service` or `action`, not both"
    ): vol.In(SHORTCUTS),
    vol.Optional(ATTR_DATA, default=dict): dict,
    vol.Exclusive(ATTR_AT, "when", msg="send either `at` or `in`, not both"): (
        clock_time_or_datetime
    ),
    vol.Exclusive(ATTR_IN, "when", msg="send either `at` or `in`, not both"): vol.All(
        vol.Coerce(int), vol.Range(min=1, msg="`in` is a number of minutes above 0")
    ),
    vol.Optional(ATTR_NAME): vol.All(cv.string, vol.Strip, vol.Length(max=255)),
}

ADD_SCHEMA = vol.All(
    vol.Schema(ADD_FIELDS),
    cv.has_at_least_one_key(ATTR_AT, ATTR_IN),
    cv.has_at_least_one_key(ATTR_SERVICE, ATTR_ACTION),
    _action_needs_entity,
)


def due_time(
    *,
    at: time | datetime | None,
    minutes: int | None,
    now: datetime,
    time_zone: tzinfo,
) -> datetime:
    """The UTC due time of a new schedule.

    A clock time is today in `time_zone`, or tomorrow once it has passed. A date and time
    without an offset is in `time_zone`. Minutes count from `now`.
    """
    if minutes is not None:
        return (now + timedelta(minutes=minutes)).astimezone(dt_util.UTC)
    if isinstance(at, datetime):
        local = at if at.tzinfo else at.replace(tzinfo=time_zone)
        return local.astimezone(dt_util.UTC)
    if isinstance(at, time):
        local_now = now.astimezone(time_zone)
        candidate = datetime.combine(local_now.date(), at, tzinfo=time_zone)
        if candidate <= local_now:
            candidate = datetime.combine(
                local_now.date() + timedelta(days=1), at, tzinfo=time_zone
            )
        return candidate.astimezone(dt_util.UTC)
    raise ValueError("A schedule needs `at` or `in`")
