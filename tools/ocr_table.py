#!/usr/bin/env python3
"""Читает многоколоночную таблицу со скриншота по координатам OCR.

Зачем: tesseract --psm 6 выдаёт колонки вперемешку, а в таблице из буклета
шесть подколонок (уровень/бросок/монстр × 2). TSV даёт координаты каждого
слова, поэтому колонки восстанавливаются чисто — по X.

Использование:
  python3 tools/ocr_table.py <файл.tsv> 0:75,75:215,215:430,430:560,560:660,660:999 [ytol]
"""
import sys, csv

def load(path):
    out = []
    for r in csv.DictReader(open(path, encoding='utf-8'),
                            delimiter='\t', quoting=csv.QUOTE_NONE):
        t = (r.get('text') or '').strip()
        if not t:
            continue
        try:
            out.append(dict(x=int(r['left']), y=int(r['top']),
                            w=int(r['width']), conf=float(r['conf']), t=t))
        except (ValueError, KeyError):
            pass
    return out

def main():
    path = sys.argv[1]
    spec = [tuple(int(v) for v in p.split(':')) for p in sys.argv[2].split(',')]
    ytol = int(sys.argv[3]) if len(sys.argv) > 3 else 8

    rows = load(path)
    if not rows:
        print('нет слов'); return 1

    def bucket(x):
        for i, (lo, hi) in enumerate(spec):
            if lo <= x < hi:
                return i
        return len(spec) - 1

    for r in rows:
        r['b'] = bucket(r['x'])

    # строки по Y
    lines = []
    for r in sorted(rows, key=lambda r: r['y']):
        for ln in lines:
            if abs(ln['y'] - r['y']) <= ytol:
                ln['w'].append(r)
                ln['y'] = sum(w['y'] for w in ln['w']) / len(ln['w'])
                break
        else:
            lines.append({'y': r['y'], 'w': [r]})
    lines.sort(key=lambda l: l['y'])

    hdr = ' | '.join('%-14s' % ('x%d' % i) for i in range(len(spec)))
    print('Y    | ' + hdr)
    print('-' * (7 + len(hdr) + 5 * len(spec)))
    for ln in lines:
        cells = [''] * len(spec)
        worst = 100.0
        for w in sorted(ln['w'], key=lambda r: r['x']):
            cells[w['b']] += (' ' if cells[w['b']] else '') + w['t']
            worst = min(worst, w['conf'])
        mark = '  <<' if worst < 55 else ''
        print('%5d | %s%s' % (ln['y'], ' | '.join('%-14s' % c for c in cells), mark))
    return 0

if __name__ == '__main__':
    sys.exit(main())
