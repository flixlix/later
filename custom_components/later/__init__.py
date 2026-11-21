"""Later: one-off scheduled actions for Home Assistant.

A schedule calls one service at its due time, then deletes itself. Schedules live in
`.storage/later.storage`; missed ones run once shortly after startup.
"""

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
    callback,
)
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration
import voluptuous as vol

from .const import (
    ATTR_ID,
    CARD_URL,
    DOMAIN,
    SERVICE_ADD,
    SERVICE_CANCEL,
    SERVICE_RUN_NOW,
    SOURCE_SERVICE,
    STARTUP_DELAY,
)
from .schedules import Schedules
from .schema import ADD_SCHEMA
from .store import ScheduleStore
from .websocket import async_register_websocket

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

CARD_FILE = Path(__file__).parent / "www" / "later-card.js"

type LaterConfigEntry = ConfigEntry[Schedules]

ID_SCHEMA = vol.Schema({vol.Required(ATTR_ID): cv.string})


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the services, the websocket API and the card."""
    async_register_websocket(hass)
    _register_services(hass)
    await _async_register_card(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: LaterConfigEntry) -> bool:
    """Load the stored schedules; arm or run them once Home Assistant has started."""
    store = ScheduleStore(hass)
    await store.async_load()
    schedules = Schedules(hass, store)
    entry.runtime_data = schedules

    @callback
    def _after_start(_hass: HomeAssistant) -> None:
        entry.async_on_unload(
            async_call_later(hass, STARTUP_DELAY, schedules.async_start)
        )

    entry.async_on_unload(async_at_started(hass, _after_start))
    entry.async_on_unload(schedules.async_stop)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: LaterConfigEntry) -> bool:
    """Disarm every timer; schedules stay stored for the next setup."""
    return True


def _schedules(hass: HomeAssistant) -> Schedules:
    entries: list[LaterConfigEntry] = hass.config_entries.async_loaded_entries(DOMAIN)
    if not entries:
        raise ServiceValidationError(
            "Later is not set up",
            translation_domain=DOMAIN,
            translation_key="not_loaded",
        )
    return entries[0].runtime_data


def _register_services(hass: HomeAssistant) -> None:
    async def add(call: ServiceCall) -> ServiceResponse:
        schedule = await _schedules(hass).async_create(
            dict(call.data), source=SOURCE_SERVICE
        )
        return dict(schedule)

    async def cancel(call: ServiceCall) -> None:
        await _schedules(hass).async_cancel(call.data[ATTR_ID])

    async def run_now(call: ServiceCall) -> None:
        await _schedules(hass).async_run_now(call.data[ATTR_ID])

    hass.services.async_register(
        DOMAIN,
        SERVICE_ADD,
        add,
        schema=ADD_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(DOMAIN, SERVICE_CANCEL, cancel, schema=ID_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RUN_NOW, run_now, schema=ID_SCHEMA)


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the card and load it on every dashboard, so no resource is needed."""
    if not await hass.async_add_executor_job(CARD_FILE.is_file):
        _LOGGER.warning(
            "%s is missing, so the Later card is not loaded; build it with `pnpm build:integration`",
            CARD_FILE,
        )
        return
    integration = await async_get_integration(hass, DOMAIN)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_FILE), cache_headers=False)]
    )
    add_extra_js_url(hass, f"{CARD_URL}?v={integration.version}")
