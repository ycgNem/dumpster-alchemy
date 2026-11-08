"""The game's palette for the art scripts, read straight from src/data/palette.ts.

    from pal import PAL, rgb, RAMP
    rgb('ink0')        -> (26, 20, 34)
    RAMP['rust']       -> ['rust0', 'rust1', 'rust2', 'rust3']

palette.ts is the source of truth, so the scripts and the game never drift apart.
"""
import pathlib
import re

_SRC = pathlib.Path(__file__).resolve().parents[1] / 'src' / 'data' / 'palette.ts'
_TEXT = _SRC.read_text(encoding='utf-8')

PAL: dict[str, str] = {
    m.group(1): m.group(2).lower()
    for m in re.finditer(r"(\w+):\s*'#([0-9a-fA-F]{6})'", _TEXT)
}


def rgb(name: str) -> tuple[int, int, int]:
    h = PAL[name]
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def rgba(name: str) -> tuple[int, int, int, int]:
    return (*rgb(name), 255)


RAMP: dict[str, list[str]] = {}
for _name in PAL:
    _m = re.fullmatch(r'([a-z]+)(\d)', _name)
    if _m:
        RAMP.setdefault(_m.group(1), []).append(_name)

ALL_RGB: list[tuple[int, int, int]] = [rgb(n) for n in PAL]


def snap(c: tuple[int, int, int]) -> tuple[int, int, int]:
    """Nearest palette colour (plain RGB distance; good enough for snapping drafts)."""
    return min(ALL_RGB, key=lambda p: sum((a - b) ** 2 for a, b in zip(p, c)))


if __name__ == '__main__':
    print(f'{len(PAL)} colours')
    for ramp, names in RAMP.items():
        print(f'  {ramp}: {", ".join(names)}')
