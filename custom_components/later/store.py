"""Pending schedules in Home Assistant storage (`.storage/later.storage`)."""

from typing import Any, Literal, TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class Schedule(TypedDict):
    """One pending one-off action. Mirrored by `Schedule` in packages/later-card."""

    id: str
    name: str
    # UTC ISO-8601
    run_at: str
    created_at: str
    service: str
    data: dict[str, Any]
    entity_id: str | None
    source: Literal["card", "service"]


class StoredSchedules(TypedDict):
    """What the storage file holds."""

    schedules: list[Schedule]


class LaterStorage(Store[StoredSchedules]):
    """Storage that upgrades files written by older versions."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> StoredSchedules:
        """Upgrade an older file. Version 1 is the first; later versions add steps."""
        raise NotImplementedError(
            f"Cannot read {STORAGE_KEY} version {old_major_version}.{old_minor_version}"
        )


class ScheduleStore:
    """Load, put, delete and list schedules; every change is saved at once."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Bind to the storage file."""
        self._store = LaterStorage(hass, STORAGE_VERSION, STORAGE_KEY)
        self._schedules: dict[str, Schedule] = {}

    async def async_load(self) -> None:
        """Read the stored schedules."""
        stored = await self._store.async_load()
        schedules = stored["schedules"] if stored else []
        self._schedules = {schedule["id"]: schedule for schedule in schedules}

    def get(self, schedule_id: str) -> Schedule | None:
        """The schedule with this id, if it is pending."""
        return self._schedules.get(schedule_id)

    def list(self) -> list[Schedule]:
        """Pending schedules, soonest first."""
        return sorted(self._schedules.values(), key=lambda s: (s["run_at"], s["id"]))

    async def async_put(self, schedule: Schedule) -> None:
        """Add a schedule, or replace the one with its id, and save."""
        self._schedules[schedule["id"]] = schedule
        await self._async_save()

    async def async_delete(self, schedule_id: str) -> Schedule | None:
        """Remove a schedule and save; None if it was not pending."""
        schedule = self._schedules.pop(schedule_id, None)
        if schedule is not None:
            await self._async_save()
        return schedule

    async def _async_save(self) -> None:
        # Saved right away, not delayed: a schedule created just before a crash must survive.
        await self._store.async_save({"schedules": self.list()})
