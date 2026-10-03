#!/usr/bin/env python3
"""Ad-hoc verification for the --swal-* token migration of
apps/pisastyle/src/components/.

Nothing here is hardcoded: the tokens come from the core theme.css and the
declarations to check come from the components themselves, so the gate fails
both when a literal color creeps back in and when a component is repointed at
a token that no longer holds up.

  1. STATIC   — every color/background/border/outline declaration must
     reference a --swal-* token, never a literal.
  2. TOKEN    — every referenced token must exist in the core theme.
  3. CONTRAST — WCAG 2.2 sRGB relative luminance for each `color:` against
     the surface that element actually paints on, each translucent token
     alpha-composited over the real theme canvas.

Usage: python3 scripts/verify-swallow-tokens.py     (exit 0 = pass, 1 = fail)
"""

import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
COMPONENTS = APP / 'src/components'
CORE_THEME = APP.parent.parent / 'cores/swal-ui/src/tokens/theme.css'

# Superficie por defecto: la de una tarjeta/panel del core, o sea el fondo real
# de un elemento que no declara el suyo.
DEFAULT_SURFACE = '--swal-surface'
TEXT_MIN = 4.5  # WCAG 2.2 AA para texto normal


# ── WCAG 2.2 ──────────────────────────────────────────────────────────────
def lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lum(rgb):
    r, g, b = rgb
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def over(fg, alpha, bg):
    return tuple(fg[i] * alpha + bg[i] * (1 - alpha) for i in range(3))


def ratio(fg, bg):
    hi, lo = max(lum(fg), lum(bg)), min(lum(fg), lum(bg))
    return (hi + 0.05) / (lo + 0.05)


# ── tokens del tema ───────────────────────────────────────────────────────
def parse_color(text):
    text = text.strip()
    if m := re.fullmatch(r'#([0-9a-fA-F]{3,8})', text):
        h = m.group(1)
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)), 1.0
    if m := re.fullmatch(r'rgba?\(([^)]+)\)', text):
        p = [x.strip() for x in m.group(1).split(',')]
        return tuple(float(x) for x in p[:3]), float(p[3]) if len(p) > 3 else 1.0
    raise ValueError('unsupported color literal: %r' % text)


def theme_resolver(css, selector_re):
    """Token name -> (rgb, alpha as declared) for one theme block, aliases followed."""
    m = re.search(selector_re + r'\s*\{(.*?)\n\}', css, re.S)
    if not m:
        raise SystemExit('token block not found: ' + selector_re)
    tokens = {d.group(1): d.group(2).strip()
              for d in re.finditer(r'(--[\w-]+)\s*:\s*([^;]+);', m.group(1))}
    cache = {}

    def resolve(name):
        if name in cache:
            return cache[name]
        raw = tokens[name].strip()
        # Un alias del core apunta a un ROL, nunca a un color: seguirlo es
        # obligatorio o el texto semantico se pierde.
        val = resolve(raw[4:-1].strip()) if raw.startswith('var(') else parse_color(raw)
        cache[name] = val
        return val

    return resolve


# El bloque oscuro abre con `:root,` y `[data-theme='dark']` en la misma regla,
# asi que su selector es una alternancia, no un selector simple.
THEMES = [('dark', r":root,\s*\n\[data-theme='dark'\]"), ('light', r"\[data-theme='light'\]")]
CORE_CSS = CORE_THEME.read_text(encoding='utf8')


def painted(resolve, token, canvas):
    """(rgb, alpha=1) del token ya compuesto sobre el canvas: el color real."""
    rgb, alpha = resolve(token)
    return (over(rgb, alpha, canvas), 1.0) if alpha < 1 else (rgb, 1.0)


# ── CSS de los componentes ────────────────────────────────────────────────
# `border-collapse`/`border-spacing` son layout: un borde de 1px siempre pasa por
# el shorthand `border`, que es el unico que lleva color.
DECL = re.compile(r'\b(color|background|background-color|border|outline)\s*:\s*([^;{}]+)')
RULE = re.compile(r'([^{}]+)\{([^{}]*)\}', re.S)


def blank_comments(text):
    """Sustituye comentarios por saltos de linea: un color citado en un
    comentario es la medicion documentada del contraste, no un estilo."""
    blank = lambda m: '\n' * m.group(0).count('\n')
    return re.sub(r'<!--.*?-->', blank, re.sub(r'/\*.*?\*/', blank, text, flags=re.S), flags=re.S)


def sel_name(raw):
    """Primera linea no vacia del selector: los estilos de Svelte siguen al
    selector, y las reglas multilinea dejan lineas en blanco antes."""
    for line in raw.splitlines():
        if line.strip():
            return line.strip().rstrip('{').strip()
    return ''


STYLE_BLOCK = re.compile(r'<style[^>]*>(.*?)</style>', re.S)


def scan(path):
    """Del componente: literales de color, textos (linea, fg, selector) y el
    token de fondo por selector.

    Solo se lee el interior de <style>: el template y el script de Svelte traen
    llaves (`{#if}`, `{ title }`) que descuadrarían el parseo de reglas.
    """
    rel = path.relative_to(APP)
    source = blank_comments(path.read_text(encoding='utf8'))
    literals, texts, backgrounds = [], [], {}
    for block in STYLE_BLOCK.finditer(source):
        css = block.group(1)
        offset = source.count('\n', 0, block.start(1))
        for rule in RULE.finditer(css):
            sel = sel_name(rule.group(1))
            body = rule.group(2)
            base = offset + css.count('\n', 0, rule.start())
            found_bg = None
            for d in DECL.finditer(body):
                prop, value = d.group(1), d.group(2).strip()
                line = base + body.count('\n', 0, d.start())
                tok = re.search(r'var\((--[\w-]+)', value)
                if not tok:
                    literals.append('%s:%d  %s: %s' % (rel, line, prop, value))
                    continue
                if prop.startswith('background'):
                    found_bg = found_bg or tok.group(1)
                elif prop == 'color':
                    texts.append((rel, line, tok.group(1), sel))
            if found_bg:
                backgrounds[sel] = found_bg
    return literals, texts, backgrounds


files = sorted(p for p in COMPONENTS.rglob('*') if p.suffix in ('.svelte', '.astro'))
all_literals, records, backgrounds = [], [], {}
for path in files:
    lits, texts, bg = scan(path)
    all_literals += lits
    backgrounds.update(bg)
    records += texts

referenced = set(re.findall(r'var\((--swal-[\w-]+)',
                            '\n'.join(blank_comments(p.read_text(encoding='utf8')) for p in files)))
defined = set(re.findall(r'(--swal-[\w-]+)\s*:', CORE_CSS))
unknown = sorted(referenced - defined)


def background_token(selector):
    """Fondo efectivo de un selector: el suyo, o el de la clase padre mas
    cercana que lo declare (`.consent-banner .buttons` -> `.consent-banner`)."""
    if selector in backgrounds:
        return backgrounds[selector], selector
    parts = selector.replace('>', ' ').split()
    while len(parts) > 1:
        parts.pop()
        ancestor = ' '.join(parts)
        if ancestor in backgrounds:
            return backgrounds[ancestor], ancestor
    return DEFAULT_SURFACE, DEFAULT_SURFACE


# ── informe ───────────────────────────────────────────────────────────────
failures = list(all_literals) + ['token no declarado por el core: ' + t for t in unknown]

print('componentes revisados: %d   tokens referenciados: %d' % (len(files), len(referenced)))
print('literales de color fuera de tokens: %d' % len(all_literals))
for x in all_literals:
    print('   ' + x)
print('tokens --swal-* no declarados por el core: %s' % (unknown or 'ninguno'))

print('\ncontraste WCAG 2.2 de cada `color:` contra la superficie que realmente pinta')
for theme, selector in THEMES:
    resolve = theme_resolver(CORE_CSS, selector)
    canvas = resolve('--swal-bg')[0]
    print('\n  --- %s (canvas #%02x%02x%02x) ---' % (theme, *canvas))
    for rel, line, fg_tok, sel in records:
        bg_tok, bg_sel = background_token(sel)
        try:
            fg_rgb, fg_alpha = resolve(fg_tok)
            bg = painted(resolve, bg_tok, canvas)[0]
        except KeyError:
            continue
        rr = ratio(over(fg_rgb, fg_alpha, bg), bg)
        ok = rr >= TEXT_MIN
        note = '' if bg_sel == bg_tok else '  (de %s)' % bg_sel
        print('  %s %-38s %-22s sobre %-22s %6.2f:1  min %.1f%s'
              % ('OK ' if ok else 'FAIL', '%s:%d' % (rel, line), fg_tok, bg_tok, rr, TEXT_MIN, note))
        if not ok:
            failures.append('%s %s:%d %s sobre %s = %.2f:1 < %.1f:1'
                            % (theme, rel, line, fg_tok, bg_tok, rr, TEXT_MIN))

print()
if failures:
    print('FALLOS (%d)' % len(failures))
    for f in failures:
        print('  ' + f)
    sys.exit(1)
print('OK: %d declaraciones de texto AA en ambos temas; 0 literales; 0 tokens desconocidos.'
      % len(records))