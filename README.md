# Dungeon Gen

Одностраничный генератор подземелья для соло-игры «вслепую»: без карты и без
спойлеров, только журнал бросков. Один автономный HTML-файл, работает офлайн.

Открыть: https://dexius9669.github.io/pages/Dungeon_Gen.html

## Что внутри

- `src/engine/` — детерминированный PRNG (mulberry32) и табличная машина состояний.
- `src/data/` — таблицы Буклетов 4/2/10 и «Stocking Monsters».
- `src/ui/` — интерфейс; `build.py` собирает из модулей единый `Dungeon_Gen.html`.
- `test/` — тесты: `rng`, `validate`, `flow`, `bundle`.
- `tools/` — вспомогательные скрипты (OCR, превью).
- `Booklet_2.txt`, `Random_Dungeon`, `Oracles`, `Stocking Monsters` — исходные тексты таблиц.
- `LEGAL.md` — правовые уведомления и лицензия.

## Сборка и тесты

```bash
python3 build.py
node test/rng.test.js
node test/validate.js
node test/flow.test.js
node test/bundle.test.js
```

## Лицензия

Воспроизводит и адаптирует процедуры и таблицы из
«Midwest Fantasy Wargame: The Primeval RPG (version 1)», © 2025 Rod Hampton,
по лицензии CC-BY-4.0. Неофициальный инструмент, не связан с правообладателями.
Подробности — в `LEGAL.md`.
