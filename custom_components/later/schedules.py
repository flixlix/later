"""Pending schedules at runtime: arm timers, run due actions, tell subscribers."""

from collections.abc import Callable
from datetime import datetime
import logging
import secrets
from typing import Any, Literal, TypedDict

from homeassistant.const import ATTR_FRIENDLY_NAME
from homeassistant.core import CALLBACK_TYPE, Context, HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_ACTION,
    ATTR_AT,
    ATTR_DATA,
    ATTR_ENTITY_ID,
    ATTR_IN,
    ATTR_NAME,
    ATTR_SERVICE,
    DOMAIN,
    EVENT_RAN,
    LATE_AFTER,
)
from .schema import due_time
from .store import Schedule, ScheduleStore

_LOGGER = logging.getLogger(__name__)

type ChangeType = Literal[
    "created", "updated", "cancelled", "ran", "late_ran", "failed"
]


class ScheduleChange(TypedDict):
    """What `later/subscribe` pushes: the change, and the pending list after it."""

    type: ChangeType
    schedule: Schedule
    schedules: list[Schedule]


type ChangeListener = Callable[[ScheduleChange], None]


def _iso(moment: datetime) -> str:
    return moment.astimezone(dt_util.UTC).replace(microsecond=0).isoformat()


class Schedules:
    """The pending schedules of one Later config entry."""

    def __init__(self, hass: HomeAssistant, store: ScheduleStore) -> None:
        """Wrap the store; nothing is armed until `async_start`."""
        self._hass = hass
        self._store = store
        self._timers: dict[str, CALLBACK_TYPE] = {}
        self._listeners: set[ChangeListener] = set()
        self._started = False

    def get(self, schedule_id: str) -> Schedule | None:
        """The pending schedule with this id, if any."""
        return self._store.get(schedule_id)

    def list(self) -> list[Schedule]:
        """Pending schedules, soonest first."""
        return self._store.list()

    @callback
    def async_subscribe(self, listener: ChangeListener) -> CALLBACK_TYPE:
        """Call `listener` after every change; returns the unsubscribe callback."""
        self._listeners.add(listener)
        return lambda: self._listeners.discard(listener)

    async def async_start(self, _now: datetime | None = None) -> None:
        """Arm future schedules and run the ones missed while Home Assistant was down."""
        self._started = True
        now = dt_util.utcnow()
        missed = []
        for schedule in self._store.list():
            if dt_util.parse_datetime(schedule["run_at"], raise_on_error=True) > now:
                self._arm(schedule)
            else:
                missed.append(schedule["id"])
        for schedule_id in missed:
            await self._async_run(schedule_id, missed=True)

    @callback
    def async_stop(self) -> None:
        """Disarm every timer; the schedules stay stored."""
        self._started = False
        for cancel in self._timers.values():
            cancel()
        self._timers.clear()

    async def async_create(self, request: dict[str, Any], *, source: str) -> Schedule:
        """Store a schedule from a validated `ADD_SCHEMA` request and arm it."""
        now = dt_util.utcnow()
        schedule = self._build(
            request,
            schedule_id=self._new_id(),
            created_at=now,
            source="card" if source == "card" else "service",
            name=request.get(ATTR_NAME),
        )
        await self._store.async_put(schedule)
        if self._started:
            self._arm(schedule)
        self._notify("created", schedule)
        return schedule

    async def async_update(self, schedule_id: str, request: dict[str, Any]) -> Schedule:
        """Replace a pending schedule's action, due time and name; it keeps its id.

        Without a name in `request`, a schedule that had the default name gets the default
        name of its new action and due time; a name someone picked stays.
        """
        old = self._store.get(schedule_id)
        if old is None:
            raise _not_found(schedule_id)
        old_default = self._default_name(
            old["entity_id"],
            old["service"],
            dt_util.parse_datetime(old["run_at"], raise_on_error=True),
        )
        schedule = self._build(
            request,
            schedule_id=schedule_id,
            created_at=dt_util.parse_datetime(old["created_at"], raise_on_error=True),
            source=old["source"],
            name=request.get(ATTR_NAME)
            or (None if old["name"] == old_default else old["name"]),
        )
        await self._store.async_put(schedule)
        if self._started:
            self._arm(schedule)
        self._notify("updated", schedule)
        return schedule

    def _build(
        self,
        request: dict[str, Any],
        *,
        schedule_id: str,
        created_at: datetime,
        source: Literal["card", "service"],
        name: str | None,
    ) -> Schedule:
        """A schedule from a validated `ADD_SCHEMA` request; the default name without `name`."""
        run_at = due_time(
            at=request.get(ATTR_AT),
            minutes=request.get(ATTR_IN),
            now=dt_util.utcnow(),
            time_zone=dt_util.get_default_time_zone(),
        )
        entity_id: str | None = request.get(ATTR_ENTITY_ID)
        service = request.get(ATTR_SERVICE) or _shortcut_service(
            request[ATTR_ACTION], entity_id
        )
        return {
            "id": schedule_id,
            "name": name or self._default_name(entity_id, service, run_at),
            "run_at": _iso(run_at),
            "created_at": _iso(created_at),
            "service": service,
            "data": dict(request[ATTR_DATA]),
            "entity_id": entity_id,
            "source": source,
        }

    async def async_cancel(self, schedule_id: str) -> Schedule:
        """Delete a schedule without running it."""
        self._disarm(schedule_id)
        schedule = await self._store.async_delete(schedule_id)
        if schedule is None:
            raise _not_found(schedule_id)
        self._notify("cancelled", schedule)
        return schedule

    async def async_run_now(self, schedule_id: str) -> None:
        """Run a pending schedule now, then delete it."""
        if self._store.get(schedule_id) is None:
            raise _not_found(schedule_id)
        await self._async_run(schedule_id)

    def _new_id(self) -> str:
        while (schedule_id := secrets.token_hex(4)) and self._store.get(schedule_id):
            pass
        return schedule_id

    def _default_name(
        self, entity_id: str | None, service: str, run_at: datetime
    ) -> str:
        """`Heater: turn off at 20:00`."""
        target = service
        if entity_id:
            state = self._hass.states.get(entity_id)
            target = (state and state.attributes.get(ATTR_FRIENDLY_NAME)) or entity_id
        verb = service.split(".", 1)[1].replace("_", " ")
        clock = dt_util.as_local(run_at).strftime("%H:%M")
        return f"{target}: {verb} at {clock}"

    def _arm(self, schedule: Schedule) -> None:
        schedule_id = schedule["id"]
        self._disarm(schedule_id)

        @callback
        def _due(_now: datetime) -> None:
            self._timers.pop(schedule_id, None)
            self._hass.async_create_task(
                self._async_run(schedule_id), f"later run {schedule_id}"
            )

        self._timers[schedule_id] = async_track_point_in_utc_time(
            self._hass,
            _due,
            dt_util.parse_datetime(schedule["run_at"], raise_on_error=True),
        )

    def _disarm(self, schedule_id: str) -> None:
        if cancel := self._timers.pop(schedule_id, None):
            cancel()

    async def _async_run(self, schedule_id: str, *, missed: bool = False) -> None:
        """Delete the schedule, then call its action once.

        Deleting first means an action that restarts Home Assistant cannot run again.
        `missed`: due while Home Assistant was down, so late however little.
        """
        self._disarm(schedule_id)
        schedule = await self._store.async_delete(schedule_id)
        if schedule is None:
            return
        due = dt_util.parse_datetime(schedule["run_at"], raise_on_error=True)
        ran_at = dt_util.utcnow()
        late = missed or ran_at - due > LATE_AFTER
        if late:
            _LOGGER.warning(
                "Schedule %s (%s) was due at %s and runs late at %s",
                schedule["id"],
                schedule["name"],
                schedule["run_at"],
                _iso(ran_at),
            )
        error = await self._async_call(schedule)
        self._hass.bus.async_fire(
            EVENT_RAN,
            {
                "id": schedule["id"],
                "name": schedule["name"],
                "service": schedule["service"],
                "entity_id": schedule["entity_id"],
                "run_at": schedule["run_at"],
                "ran_at": _iso(ran_at),
                "late": late,
                "success": error is None,
                "error": error,
            },
        )
        if error is not None:
            self._notify("failed", schedule)
        else:
            self._notify("late_ran" if late else "ran", schedule)

    async def _async_call(self, schedule: Schedule) -> str | None:
        """Call the action; the error message if it failed. Never retried."""
        domain, service = schedule["service"].split(".", 1)
        data = dict(schedule[ATTR_DATA])
        if schedule["entity_id"] and ATTR_ENTITY_ID not in data:
            data[ATTR_ENTITY_ID] = schedule["entity_id"]
        try:
            await self._hass.services.async_call(
                domain, service, data, blocking=True, context=Context()
            )
        except Exception as err:  # The schedule is gone either way; log what failed.
            _LOGGER.exception(
                "Schedule %s (%s) failed: %s on %s",
                schedule["id"],
                schedule["name"],
                schedule["service"],
                schedule["entity_id"] or "no target",
            )
            return str(err) or type(err).__name__
        return None

    @callback
    def _notify(self, change: ChangeType, schedule: Schedule) -> None:
        message: ScheduleChange = {
            "type": change,
            "schedule": schedule,
            "schedules": self._store.list(),
        }
        for listener in list(self._listeners):
            listener(message)


def _shortcut_service(action: str, entity_id: str | None) -> str:
    if entity_id is None:
        raise ServiceValidationError(
            "`action` needs an `entity_id`",
            translation_domain=DOMAIN,
            translation_key="action_needs_entity",
        )
    return f"{entity_id.split('.', 1)[0]}.{action}"


def _not_found(schedule_id: str) -> ServiceValidationError:
    return ServiceValidationError(
        f"No pending schedule with id {schedule_id}",
        translation_domain=DOMAIN,
        translation_key="not_found",
        translation_placeholders={"id": schedule_id},
    )
