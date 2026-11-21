"""Constants for Later."""

from datetime import timedelta
from typing import Final

DOMAIN: Final = "later"

STORAGE_KEY: Final = "later.storage"
STORAGE_VERSION: Final = 1

# Entities need a moment after Home Assistant has started before schedules act on them.
STARTUP_DELAY: Final = timedelta(seconds=10)
# A timer that fires more than this long after the due time is logged as late;
# schedules missed while Home Assistant was down are always late.
LATE_AFTER: Final = timedelta(minutes=1)

CARD_URL: Final = "/later/later-card.js"

SERVICE_ADD: Final = "add"
SERVICE_CANCEL: Final = "cancel"
SERVICE_RUN_NOW: Final = "run_now"

WS_LIST: Final = "later/list"
WS_ADD: Final = "later/add"
WS_CANCEL: Final = "later/cancel"
WS_SUBSCRIBE: Final = "later/subscribe"

# Fired on the event bus after every run; the logbook describes it.
EVENT_RAN: Final = "later_ran"

ATTR_ID: Final = "id"
ATTR_NAME: Final = "name"
ATTR_ENTITY_ID: Final = "entity_id"
ATTR_SERVICE: Final = "service"
ATTR_ACTION: Final = "action"
ATTR_DATA: Final = "data"
ATTR_AT: Final = "at"
ATTR_IN: Final = "in"

SHORTCUTS: Final = ("turn_on", "turn_off", "toggle")

SOURCE_CARD: Final = "card"
SOURCE_SERVICE: Final = "service"
