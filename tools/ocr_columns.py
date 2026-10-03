#!/usr/bin/env python3
"""Собирает колонки из tesseract TSV по координате X.

Зачем: tesseract --psm 6 мешает колонки в одну ленту. TSV даёт левую
координату каждого слова, а в многоколоночной таблице X однозначно
определяет колонку. Группируем слова в строки по Y, строки — в колонки
по X, и печатаем колонки раздельно.

Использование: python3 tools/ocr_columns.py .ocr/<файл>.tsv [порог-разрыва]
"""
import sys, csv, collections

def load(path):
    rows = []
    with open(path, encoding='utf-8') as f:
        for r in csv.DictReader(f, delimiter='\t', quoting=csv.QUOTE_NONE):
            t = (r.get('text') or '').strip()
            if not t:
                continue
            try:
                rows.append(dict(x=int(r['left']), y=int(r['top']),
                                 w=int(r['width']), h=int(r['height']),
                                 conf=float(r['conf']), t=t))
            except (ValueError, KeyError):
                pass
    return rows

def split_columns(rows, gap):
    """Разрывы по X, где ни одного слова дольше gap."""
    if not rows:
        return [rows]
    cols, cur, cur_max = [], [], None
    for r in sorted(rows, key=lambda r: r['x']):
        if cur_max is not None and r['x'] - cur_max > gap:
            cols.append(cur); cur, cur_max = [], None
        cur.append(r)
        cur_max = r['x'] + r['w'] if cur_max is None else max(cur_max, r['x'] + r['w'])
    if cur:
        cols.append(cur)
    return cols

def to_lines(col, ytol):
    """Слова колонки → строки по близости Y."""
    lines = []
    for r in sorted(col, key=lambda r: (r['y'], r['x'])):
        placed = False
        for ln in lines:
            if abs(ln['y'] - r['y']) <= ytol:
                ln['w'].append(r); ln['y'] = (ln['y'] * len(ln['w']) + r['y']) / (len(ln['w']) + 1)
                placed = True
                break
        if not placed:
            lines.append({'y': r['y'], 'w': [r]})
    for ln in lines:
        ln['w'].sort(key=lambda r: r['x'])
        ln['text'] = ' '.join(w['t'] for w in ln['w'])
        ln['conf'] = min(w['conf'] for w in ln['w'])
    lines.sort(key=lambda l: l['y'])
    return lines

def main():
    path = sys.argv[1]
    gap = int(sys.argv[2]) if len(sys.argv) > 2 else 28
    ytol = int(sys.argv[3]) if len(sys.argv) > 3 else 7
    rows = load(path)
    if not rows:
        print('нет слов'); return 1
    cols = split_columns(rows, gap)
    print('колонок: %d   слов: %d\n' % (len(cols), len(rows)))
    for i, col in enumerate(cols, 1):
        lines = to_lines(col, ytol)
        xs = min(r['x'] for r in col)
        xe = max(r['x'] + r['w'] for r in col)
        print('─' * 62)
        print('КОЛОНКА %d   x=%d..%d   строк=%d' % (i, xs, xe, len(lines)))
        print('─' * 62)
        for ln in lines:
            flag = '  <<' if ln['conf'] < 60 else ''
            print('%5d | %s%s' % (ln['y'], ln['text'], flag))
        print()
    return 0

if __name__ == '__main__':
    sys.exit(main())
