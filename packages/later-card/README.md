# Later card

> [!TIP]
> Full documentation: **[github.com/flixlix/later](https://github.com/flixlix/later#card)**.

The Lovelace card of the [Later](https://github.com/flixlix/later) integration: schedule a Home Assistant action once, at a clock time or in a few minutes, and see what is pending.

It ships inside the integration and is loaded on every dashboard automatically; there is no separate HACS download or dashboard resource. It needs the `later` integration and shows an error without it.

```yaml
type: custom:later-card
title: Later # optional, default "Later"
entity: switch.heater # optional, preselected when scheduling
```

Built with `pnpm build:integration` into `custom_components/later/www/later-card.js`.
