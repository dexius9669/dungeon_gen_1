#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка автономного Dungeon_Gen.html.

Модули проекта — CommonJS (require/module.exports), а интерфейс должен
работать из одного файла, который открывают двойным щелчком, без сервера
и без node_modules. Поэтому здесь свой микросборщик:

  * обход графа require'ов от точки входа;
  * КАЖДЫЙ require резолвится на этапе сборки и подменяется ключом модуля —
    рантайм не занимается разбором путей, поэтому нечему сломаться;
  * каждый модуль оборачивается в функцию со своими module/exports/require,
    так что верхнеуровневые const/class не протекают в общий scope.

Запуск:  python3 build.py
"""
import os
import re
import sys
import json
import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
UI = os.path.join(SRC, 'ui')
OUT = os.path.join(ROOT, 'Dungeon_Gen.html')

ENTRY = os.path.join(UI, 'app.js')
ENTRY_FN = 'init'          # функция, которая поднимает интерфейс

REQUIRE_RE = re.compile(r"""require\(\s*(['"])(.*?)\1\s*\)""")


def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def key_of(path):
    """Ключ модуля — путь относительно корня проекта со слэшами."""
    return os.path.relpath(path, ROOT).replace(os.sep, '/')


def resolve(from_file, spec):
    """require('./rng.js') -> абсолютный путь. None, если не нашёлся."""
    if not spec.startswith('.'):
        return None                      # внешний пакет: у нас таких нет
    base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
    for cand in (base, base + '.js', os.path.join(base, 'index.js')):
        if os.path.isfile(cand):
            return cand
    return None


class Bundler:
    def __init__(self):
        self.sources = {}      # key -> исходник с уже подменёнными require
        self.deps = {}         # key -> [key, ...] в порядке первого появления

    def add(self, path):
        key = key_of(path)
        if key in self.sources:
            return key
        src = read(path)
        deps = []

        def sub(m):
            target = resolve(path, m.group(2))
            if target is None:
                raise SystemExit('build: не найден модуль %s (из %s)' % (m.group(2), key))
            deps.append(self.add(target))
            return "require('%s')" % key_of(target)

        self.sources[key] = REQUIRE_RE.sub(sub, src)
        self.deps[key] = deps
        return key

    def render(self, entry_key):
        """Текст бандла. entry_key — модуль, который запускает интерфейс."""
        parts = ['(function () {',
                 '"use strict";',
                 'var factories = {']
        for key in sorted(self.sources):
            parts.append('%s: function (require, module, exports) {\n%s\n},'
                         % (json.dumps(key), self.sources[key]))
        parts.append('};')
        parts.append('var cache = {};')
        parts.append('function require(id) {')
        parts.append('  if (id in cache) return cache[id].exports;')
        parts.append('  if (!(id in factories)) throw new Error("build: нет модуля " + id);')
        parts.append('  var m = cache[id] = { exports: {} };')
        parts.append('  factories[id](require, m, m.exports);')
        parts.append('  return m.exports;')
        parts.append('}')
        parts.append('require(%s).%s();' % (json.dumps(entry_key), ENTRY_FN))
        parts.append('})();')
        return '\n'.join(parts)


# Тёмная тема — палитра и раскладка как в эталоне Dungeon_Gen_DB:
# тёмный сайдбар со столами, светлый журнал карточек справа.
CSS = """
/* Оформление повторяет эталон Dungeon_Gen_DB: почти чёрный фон, серые панели,
 * сайдбар со столами слева, журнал карточек справа, цветные левые грани
 * по категории. Tailwind и Google Fonts не тянем — файл должен работать
 * офлайн, поэтому шрифты заданы с serif-фолбэком (Cinzel/Merriweather
 * подхватятся, если установлены). */
:root{
  --page:#1a1a1a; --panel:#111827; --panel2:#1f2937; --bg:#111827;
  --card:#374151; --line:#4b5563; --line2:#6b7280;
  --ink:#e5e5e5; --dim:#9ca3af; --faint:#6b7280;
  --gold:#eab308; --blue:#93c5fd; --green:#4ade80; --purple:#d8b4fe;
  --orange:#fdba74; --red:#f87171;
  --room:#eab308; --passage:#3b82f6; --monster:#ef4444;
  --treasure:#10b981; --trick:#a855f7;
  --font-head:'Cinzel', Georgia, 'Times New Roman', serif;
  --font-body:'Merriweather', Georgia, 'Times New Roman', serif;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0; background:var(--page); color:var(--ink);
  font:15px/1.5 var(--font-body);
  display:flex; flex-direction:column; overflow:hidden;
}
button,input{font:inherit}
h1,h2,h3,button{font-family:var(--font-head)}

/* --- сайдбар --- */
aside{
  flex:none; background:var(--panel); border-bottom:1px solid var(--line);
  padding:14px 16px; overflow-y:auto; display:flex; flex-direction:column;
}
aside h1{
  font-size:17px; color:var(--gold); font-weight:700; text-align:center;
  letter-spacing:.06em; margin:0 0 12px; padding-bottom:8px;
  border-bottom:1px solid var(--line);
}
.panel{background:var(--panel2); border:1px solid var(--line); border-radius:8px;
  padding:10px 12px; margin-bottom:10px}
.panel > h2, .panel > label{
  display:block; font-size:10px; text-transform:uppercase; letter-spacing:.1em;
  color:var(--dim); font-weight:700; margin:0 0 6px;
}
.ctl-row{display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end}
.ctl{display:flex; flex-direction:column; gap:3px}
.ctl label{font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--faint)}
.ctl input{
  background:var(--bg); color:var(--ink); border:1px solid var(--line2);
  border-radius:4px; padding:5px 8px;
}
.ctl input#level{width:70px; color:var(--gold); font-weight:700}
.ctl input#seed{width:100%}
.ctl select{background:var(--bg); color:var(--ink); border:1px solid var(--line2);
  border-radius:4px; padding:5px 8px}
.btn{border:0; border-radius:5px; padding:7px 12px; cursor:pointer;
  font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:.04em}
.btn-start{width:100%; background:#991b1b; color:#fff; margin-top:8px}
.btn-start:hover{background:#b91c1c}
.btn-ghost{background:var(--card); border:1px solid var(--line2); color:var(--dim)}
.btn-ghost:hover{background:var(--line); color:var(--ink)}

/* ручные броски */
.tbtn{
  display:flex; justify-content:space-between; align-items:baseline; gap:8px;
  width:100%; text-align:left; background:var(--card); border:1px solid var(--line);
  color:var(--ink); border-radius:6px; padding:6px 9px; margin:0 0 4px;
  cursor:pointer; font-size:12px; font-family:var(--font-body);
}
.tbtn:hover{background:var(--line); border-color:var(--line2)}
.tbtn code{color:var(--gold); font-size:11px; font-weight:700; min-width:46px; flex:none;
  font-family:ui-monospace,Menlo,Consolas,monospace}
.tbtn .tdie{color:var(--faint); font-family:ui-monospace,Menlo,Consolas,monospace;
  font-size:10px; white-space:nowrap}
.group{font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--gold);
  opacity:.85; margin:8px 0 4px; font-weight:700}
.group:first-child{margin-top:0}
.row{display:flex; gap:6px; align-items:stretch}
.row input{flex:1; min-width:0; background:var(--bg); color:var(--ink);
  border:1px solid var(--line2); border-radius:4px; padding:6px 8px}
.row .tbtn{width:auto; margin:0}
.chk{display:flex; align-items:center; gap:6px; font-size:11px; color:var(--dim);
  text-transform:uppercase; letter-spacing:.05em; cursor:pointer; margin-top:8px}

/* правовые уведомления — часть автономного файла, едут вместе с ним */
.legal{margin-top:auto; padding-top:10px; border-top:1px solid var(--line);
  font-size:11px; line-height:1.45; color:var(--faint)}
.legal summary{cursor:pointer; color:var(--dim); text-transform:uppercase;
  letter-spacing:.06em; font-size:10px; font-weight:700}
.legal p{margin:6px 0}
.legal a{color:var(--blue); word-break:break-word}

/* --- журнал --- */
main{flex:1; min-height:0; display:flex; flex-direction:column; background:var(--panel2)}
.logbar{display:flex; gap:12px; align-items:center; padding:8px 18px;
  border-bottom:1px solid var(--line); background:var(--panel);
  font-size:11px; color:var(--faint); text-transform:uppercase; letter-spacing:.08em}
.logbar b{color:var(--ink); font-size:13px; text-transform:none; letter-spacing:0}
.logbar .chain{margin-left:auto; text-transform:none; letter-spacing:0; color:var(--faint)}
#log{flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:10px}
.placeholder{text-align:center; color:var(--faint); font-style:italic; opacity:.6; margin-top:60px}

.card{background:var(--card); border:1px solid var(--line); border-left:4px solid var(--line2);
  border-radius:6px; padding:10px 12px; max-width:900px;
  box-shadow:0 4px 10px rgba(0,0,0,.3); animation:fadeIn .2s ease-out}
@keyframes fadeIn{from{opacity:0; transform:translateY(5px)} to{opacity:1; transform:translateY(0)}}
.card.room-box{border-left-color:var(--room); background:rgba(234,179,8,.06)}
.card.passage-box{border-left-color:var(--passage); background:rgba(59,130,246,.05)}
.card.monster-box{border-left-color:var(--monster); background:rgba(239,68,68,.10)}
.card.treasure-box{border-left-color:var(--treasure); background:rgba(16,185,129,.08)}
.card.trick-box{border-left-color:var(--trick); background:rgba(168,85,247,.08)}
.card.hint{border-left-color:var(--faint); background:var(--panel2); animation:none}
.card.err{border-left-color:var(--red)}
.card .head{display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; margin-bottom:6px}
.card .n{display:none}
.card .tid{color:var(--gold); font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:.06em; font-family:var(--font-head)}
.card .ttl{font-weight:700; color:var(--ink); font-size:13px}
.card .lvl{margin-left:auto; font-size:10px; color:var(--faint)}
.card .dice{display:flex; gap:8px; flex-wrap:wrap; margin:4px 0 2px}
.chip{background:transparent; border:0; padding:0; font-size:11px; color:var(--faint);
  font-family:ui-monospace,Menlo,Consolas,monospace; cursor:help}
.chip b{color:var(--dim); font-weight:400}
.chip .eq{display:none}
.chip .tot{color:var(--gold); font-weight:600}
.card .body{margin-top:4px}
.card .line{color:var(--ink); padding:1px 0; font-size:14px}
.card .warn{margin-top:6px; font-size:12px; color:var(--orange); opacity:.95}
.card .chose{margin-top:8px; font-size:12px; color:var(--green); font-weight:600}
.cbtn.off{opacity:.4; cursor:not-allowed; text-decoration:line-through}
.card .choice{margin-top:10px; border-top:1px dashed var(--line); padding-top:8px}
.card .clabel{font-size:10px; text-transform:uppercase; letter-spacing:.08em;
  color:var(--faint); margin-bottom:6px}
.cbtn{display:block; width:100%; text-align:left; margin:0 0 4px;
  background:var(--panel2); border:1px solid var(--gold); color:var(--gold);
  border-radius:4px; padding:6px 9px; cursor:pointer; font-size:13px;
  font-family:var(--font-body)}
.cbtn:hover{background:var(--gold); color:#111827}
.card .next{display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:9px}
.card .nlabel{font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--faint)}
.nbtn{background:transparent; border:1px dashed var(--line2); color:var(--dim);
  border-radius:4px; padding:2px 8px; cursor:pointer; font-size:11px;
  font-family:ui-monospace,Menlo,Consolas,monospace}
.nbtn:hover{border-style:solid; border-color:var(--green); color:var(--green)}

::-webkit-scrollbar{width:8px; height:8px}
::-webkit-scrollbar-track{background:var(--panel)}
::-webkit-scrollbar-thumb{background:var(--line2); border-radius:4px}

@media (min-width:820px){
  body{flex-direction:row}
  aside{width:450px; border-right:1px solid var(--line); border-bottom:0; max-height:100vh}
}
"""

HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dungeon_Gen — генератор подземелья</title>
<style>%(css)s</style>
</head>
<body>
<aside>
  <h1>Генератор подземелья</h1>

  <div class="panel">
    <h2>Партия</h2>
    <div class="ctl-row">
      <button id="save" class="btn btn-ghost">Сохранить</button>
      <button id="load" class="btn btn-ghost">Загрузить</button>
      <button id="export" class="btn btn-ghost">Текст</button>
      <button id="clear" class="btn btn-ghost">Очистить</button>
    </div>
    <label class="chk" title="После броска автоматически выполнять следующий вероятный шаг">
      <input id="chain" type="checkbox"> автоцепочка</label>
    <div id="chainState" style="font-size:11px;color:var(--faint);margin-top:6px">цепочка выключена</div>
    <div style="font-size:11px;color:var(--faint);margin-top:6px">Зерно партии:
      <b id="seedNow">—</b></div>
  </div>

  <div class="panel">
    <h2>Уровень подземелья</h2>
    <div class="ctl-row">
      <div class="ctl"><input id="level" type="number" min="1" max="12" value="1"></div>
      <div class="ctl" style="flex:1"><label for="seed">Зерно</label>
        <input id="seed" type="text" placeholder="любое"></div>
    </div>
    <div class="group" style="margin-top:10px">Стартовый запас</div>
    <div class="ctl-row" style="margin-top:4px">
      <div class="ctl"><label for="torches">Факелы</label>
        <input id="torches" type="number" min="0" value="6"></div>
      <div class="ctl"><label for="oil">Масло</label>
        <input id="oil" type="number" min="0" value="2"></div>
      <div class="ctl" style="flex:1"><label for="lightKind">Начать со светом</label>
        <select id="lightKind">
          <option value="torch">Факел</option>
          <option value="lantern">Фонарь</option>
          <option value="mirror">Зеркальный</option>
        </select></div>
    </div>
    <div style="font-size:10px;color:var(--faint);margin-top:4px">применяется по кнопке «Начать»</div>
    <button id="start" class="btn btn-start">Начать генерацию</button>
  </div>

  <div class="panel">
    <h2>Время и свет</h2>
    <div style="font-size:12px">Время: <b id="timeNow">0 мин (0 ходов)</b></div>
    <div style="font-size:12px;margin-top:3px">Свет: <b id="lightNow">нет (темнота)</b></div>
    <div style="font-size:12px;margin-top:3px">Запас: <b id="stockNow">факелы 0, масло 0</b></div>
    <div class="ctl-row" style="margin-top:8px">
      <button id="litTorch" class="btn btn-ghost">Факел</button>
      <button id="litLantern" class="btn btn-ghost">Фонарь</button>
      <button id="litMirror" class="btn btn-ghost">Зеркальный</button>
      <button id="litOff" class="btn btn-ghost">Погасить</button>
    </div>
  </div>

  <div class="panel">
    <h2>Ручные броски</h2>
    <div id="tables"></div>
  </div>

  <details class="legal">
    <summary>Правовые уведомления</summary>
    <p>Неофициальный инструмент. Не связан с автором, издателем и
      правообладателями и не одобрен ими.</p>
    <p>Адаптирует материал из <b>Midwest Fantasy Wargame: The Primeval RPG</b>
      (version 1), © 2025 Rod Hampton — www.rodneyhamptonpc.com ·
      https://rhampton.itch.io. Лицензия
      <a href="https://creativecommons.org/licenses/by/4.0/legalcode">CC-BY-4.0</a>.</p>
    <p>Использованы Booklet 4, 2, 10 и «Stocking Monsters» того же продукта.
      Материал изменён:
      перевод на русский (включая списки слов Booklet 10), переструктурирование
      в генератор, восстановление части таблиц по сканам. Изображения
      оригинала не используются.</p>
    <p>Restricted Material — названия произведений, вся графика, а также имена
      и описания монстров и заклинаний из SRD Wizards of the Coast 2000–2003 —
      не используется как брендинг и не воспроизводится. «Dungeons &amp; Dragons»,
      «AD&amp;D», «Dungeon Master», «CHAINMAIL», «Blackmoor», «Tarn» — права их
      правообладателей (fair use).</p>
    <p>Unofficial tool. Adapts material from "Midwest Fantasy Wargame: The
      Primeval RPG" (v1), © 2025 Rod Hampton, under CC-BY-4.0. Product names,
      all imagery, and Wizards of the Coast SRD 2000–2003 monster/spell
      names are Restricted and are not reproduced. No source imagery used.
      Not affiliated with or endorsed by the rights holders.</p>
    <p><a href="https://creativecommons.org/licenses/by/4.0/legalcode">CC-BY-4.0
      · legalcode</a></p>
  </details>
</aside>

<main>
  <div class="logbar"><span>Журнал бросков</span><b id="count">0</b>
    <span class="chain" id="chainNow"></span></div>
  <div id="log"><div class="placeholder">[ Ожидание действий мастера ]</div></div>
</main>

<script>
%(bundle)s
</script>
</body>
</html>
"""

def main():
    b = Bundler()
    entry = b.add(ENTRY)
    bundle = b.render(entry)
    print('модулей в бандле: %d' % len(b.sources))
    for k in sorted(b.sources):
        print('  %s' % k)

    stamp = datetime.date.today().isoformat()
    html = (HTML
            .replace('%(css)s', CSS)
            .replace('%(bundle)s', bundle)
            .replace('%(stamp)s', stamp))
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    print('\nзаписан %s (%.1f КБ)' % (OUT, os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    main()