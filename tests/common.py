"""Helpers shared by the Later tests."""

from typing import Any

from homeassistant.core import HomeAssistant

from custom_components.later.const import DOMAIN


async def add(hass: HomeAssistant, **data: Any) -> dict[str, Any]:
    """Call `later.add` and return the created schedule."""
    response = await hass.services.async_call(
        DOMAIN, "add", data, blocking=True, return_response=True
    )
    assert response is not None
    return dict(response)


def stored(hass_storage: dict[str, Any]) -> list[dict[str, Any]]:
    """The schedules in `.storage/later.storage`."""
    return hass_storage["later.storage"]["data"]["schedules"]
