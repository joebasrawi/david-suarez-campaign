"""Give every page its own link preview.

Run after `npm run build` and scripts/build-events-preview.py. For each page it renders a
1200x630 card into assets/social/ in the video graphics style (navy, Anton caps in cream,
one key word in coral, soft fades only, no logo) and points the page's og:image at it.
Event pages are read straight from their own HTML, so the card always matches the page.
The homepage keeps the coastline photo.
"""
from pathlib import Path
import hashlib, html, io, re, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

root = Path(__file__).resolve().parents[1]
SITE = 'https://davidsuarezmb.com/'
OUT = root / 'assets/social'
FONTS = Path(__file__).resolve().parent / 'fonts'
W, H, PAD = 1200, 630, 72
NAVY, CREAM, CORAL, MINT = (11, 34, 48), (244, 240, 232), (227, 84, 57), (184, 224, 204)
SKIP_DIRS = {'node_modules', 'tmp', 'outputs', 'docs', 'sources', 'work', 'scripts', 'worker', '.git', 'live-local'}

# Headlines for the main pages. *word* marks the one coral word or phrase.
PAGES = {
    'about': dict(kicker='Miami Beach Commissioner · Group 5', headline='Meet *David* Suarez',
                  sub='South Florida native. Small-business owner. Your Group 5 commissioner.',
                  photo='assets/david-family-beach.jpg', crop=(0, 0, 1000, 1260), alt='David Suarez with his family on the beach'),
    'app': dict(kicker='Free on iPhone and Android', headline='See it. Snap it. *Report it.*',
                sub='Get the Miami Beach Gov app.', phone='app/img/home.jpg',
                alt='The Miami Beach Gov app home screen'),
    'active-projects': dict(kicker='City projects', headline='What’s being built *near you*'),
    'commission-actions': dict(kicker='City Hall', headline='What the commission *decided*'),
    'commission-agenda': dict(kicker='City Hall', headline='The next commission *agenda*'),
    'commission': dict(kicker='City Hall', headline='Your mayor & *commission*'),
    'events': dict(kicker='Miami Beach', headline='Events & *meetings*'),
    'legislation': dict(kicker='City Hall', headline='Ordinances & *resolutions*'),
    'map': dict(kicker='3D map', headline='Miami Beach *info map*'),
    'media': dict(kicker='David Suarez', headline='Watch & *listen*'),
    'meetings': dict(kicker='City Hall', headline='Meetings & how to *take part*'),
    'news': dict(kicker='News', headline='Miami Beach *today*'),
    'privacy': dict(kicker='davidsuarezmb.com', headline='Your *privacy*'),
    'resident-guide': dict(kicker='Residents', headline='Your Miami Beach *resident guide*'),
    'ride': dict(kicker='Proposed at City Hall', headline='No e-bikes or e-scooters *under 15*'),
    'search': dict(kicker='Search', headline='Explore *Miami Beach*'),
    'g20': dict(kicker='December 10–16, 2026', headline='G20 *traffic* guide',
                sub='Collins Avenue · 44th to 47th streets. Lane closures, parking and transit.'),
}


def font(name, size, weight=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    if weight:
        f.set_variation_by_name(weight)
    return f


def plain(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def meta(page, attr, key):
    m = re.search(rf'<meta {attr}="{re.escape(key)}" content="([^"]*)"', page)
    return html.unescape(m.group(1)) if m else ''


def shorten(text, limit):
    text = ' '.join(text.split())
    return text if len(text) <= limit else text[:limit - 1].rsplit(' ', 1)[0].rstrip(',.;:—–-') + '…'


def wrap_words(draw, words, fnt, width):
    lines, line = [], []
    for w in words:
        trial = ' '.join(t for t, _ in line + [w])
        if line and draw.textlength(trial, font=fnt) > width:
            lines.append(line)
            line = [w]
        else:
            line.append(w)
    if line:
        lines.append(line)
    return lines


def headline_words(text):
    """Split '*key*' markup into (word, is_key) pairs, uppercased."""
    words, key = [], False
    for token in text.split():
        start, end = token.startswith('*'), token.endswith('*')
        if start:
            key = True
        words.append((token.strip('*').upper(), key))
        if end:
            key = False
    return words


def glow(img, xy, radius, color, alpha):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    x, y = xy
    ImageDraw.Draw(layer).ellipse((x - radius, y - radius, x + radius, y + radius), fill=color + (alpha,))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(radius * 0.6)))


def fade_in_photo(img, photo, box_left, crop=None):
    """Photo fills the right side and fades softly into the navy, no hard edge."""
    src = Image.open(root / photo).convert('RGB')
    if crop:
        src = src.crop(crop)
    tw, th = W - box_left, H
    scale = max(tw / src.width, th / src.height)
    src = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    left = (src.width - tw) // 2
    src = src.crop((left, 0, left + tw, th)).convert('RGBA')  # keep the top: faces
    mask = Image.new('L', (tw, th))
    ramp = int(tw * 0.3)
    for x in range(tw):
        mask.paste(min(255, int(255 * (x / ramp) ** 1.4)) if x < ramp else 255, (x, 0, x + 1, th))
    img.paste(src, (box_left, 0), mask)


def phone_shot(img, shot):
    """The real App Store screenshot, tilted slightly, with a soft shadow."""
    src = Image.open(root / shot).convert('RGBA')
    h = 560
    src = src.resize((round(src.width * h / src.height), h), Image.LANCZOS)
    rounded = Image.new('L', src.size, 0)
    ImageDraw.Draw(rounded).rounded_rectangle((0, 0, *src.size), radius=36, fill=255)
    src.putalpha(rounded)
    src = src.rotate(-4, resample=Image.BICUBIC, expand=True)
    x, y = W - src.width - 70, (H - src.height) // 2 + 40
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 150), (x + 18, y + 24), src.split()[3])
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    img.alpha_composite(src, (x, y))


def render(kicker, headline, sub='', date_line='', photo=None, crop=None, phone=None, flyer=None):
    img = Image.new('RGBA', (W, H), NAVY + (255,))
    glow(img, (W - 120, 40), 420, MINT, 34)
    glow(img, (60, H + 60), 380, CORAL, 30)
    text_w = W - 2 * PAD
    if photo:
        fade_in_photo(img, photo, 600, crop)
        text_w = 540
    if phone:
        text_w = 700
    if flyer:
        src = Image.open(root / flyer).convert('RGBA')
        src = src.resize((round(src.width * 520 / src.height), 520), Image.LANCZOS)
        x, y = W - src.width - 64, (H - src.height) // 2
        text_w = x - PAD - 48
        shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 140), (x + 14, y + 20, x + src.width + 14, y + src.height + 20))
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)))
        img.alpha_composite(src, (x, y))
    if phone:
        phone_shot(img, phone)
    if photo:
        # Soft shade behind the words so they read over the photo's fade.
        shade = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(shade).ellipse((-260, -120, 700, H + 120), fill=NAVY + (120,))
        img.alpha_composite(shade.filter(ImageFilter.GaussianBlur(90)))
    d = ImageDraw.Draw(img)

    k_font = font('Inter.ttf', 24, b'SemiBold')
    d.text((PAD, PAD - 6), kicker.upper(), font=k_font, fill=MINT, spacing=0)
    s_font = font('Inter.ttf', 29, b'Medium')
    sub_lines = wrap_words(d, [(w, False) for w in sub.split()], s_font, text_w)[:2] if sub else []
    for date_size in range(46, 30, -2):  # keep the date on one line
        date_font = font('Anton-Regular.ttf', date_size)
        if d.textlength(date_line.upper(), font=date_font) <= text_w:
            break
    date_lines = wrap_words(d, [(w, True) for w in date_line.upper().split()], date_font, text_w)[:2] if date_line else []

    # Largest headline size that fits in four lines and leaves room for the rest.
    top, bottom = PAD + 52, H - PAD - 34
    reserved = len(sub_lines) * 40 + (34 if sub_lines else 0) + len(date_lines) * 58 + (14 if date_lines else 0)
    words = headline_words(headline)
    for size in range(124, 40, -4):
        h_font = font('Anton-Regular.ttf', size)
        lines = wrap_words(d, words, h_font, text_w)
        line_h = int(size * 1.08)
        if len(lines) <= 4 and len(lines) * line_h + reserved <= bottom - top and all(
                d.textlength(' '.join(t for t, _ in l), font=h_font) <= text_w for l in lines):
            break
    block = len(lines) * line_h + reserved
    y = top + max(0, (bottom - top - block) // 2)
    space = d.textlength(' ', font=h_font)
    for line in lines:
        x = PAD
        for word, key in line:
            d.text((x, y), word, font=h_font, fill=CORAL if key else CREAM)
            x += d.textlength(word, font=h_font) + space
        y += line_h
    if date_lines:
        y += 14
        for line in date_lines:
            d.text((PAD, y), ' '.join(t for t, _ in line), font=date_font, fill=CORAL)
            y += 58
    if sub_lines:
        y += 34
        for i, line in enumerate(sub_lines):
            text = ' '.join(t for t, _ in line)
            if i == 1 and len(wrap_words(d, [(w, False) for w in sub.split()], s_font, text_w)) > 2:
                text = text.rstrip(',.;:') + '…'
            d.text((PAD, y), text, font=s_font, fill=CREAM + (215,))
            y += 40
    d.text((PAD, H - PAD + 4), 'davidsuarezmb.com', font=font('Inter.ttf', 22, b'Medium'), fill=CREAM + (150,))
    out = io.BytesIO()
    img.convert('RGB').save(out, 'JPEG', quality=86, optimize=True, progressive=True)
    return out.getvalue()


def event_card(page):
    title = plain(re.search(r'<h1[^>]*>(.*?)</h1>', page, re.S).group(1))
    kicker = plain(re.search(r'<p class="cleanup-kicker">(.*?)</p>', page, re.S).group(1)).split('/')[-1].strip()
    lede = re.search(r'class="cleanup-lede"><strong>(.*?)</strong>(?:<br>(.*?))?</p>(?:<p>(.*?)</p>)?', page, re.S)
    date, time, place = (plain(g) for g in lede.groups()) if lede else ('', '', '')
    when = date.replace(', 20', ' · 20').split(' · ')[0] if date else ''
    if time and time != 'All day':
        when += ' · ' + re.sub(r'(–.*)? Eastern$', '', time)
    if place.startswith('See the official event notice'):
        place = ''
    place = place.split(',')[0] if place.count(',') >= 2 else place
    flyer = re.search(r'class="event-flyer"><a href="(?:\.\./)+([^"]+)"', page)
    full_place = plain(lede.group(3)) if lede and lede.group(3) else ''
    desc = ', '.join(x for x in (date, time) if x) + (' · ' + full_place if full_place else '')
    return dict(kicker=kicker or 'Events', headline=title, date_line=when, sub=shorten(place, 90), desc=desc,
                flyer=flyer.group(1) if flyer else None,
                alt=f'{title}, {date}' + (f', {time}' if time else ''))


def pages():
    for p in sorted(root.rglob('index.html')):
        rel = p.relative_to(root)
        if rel.parts[0] in SKIP_DIRS or 'http-equiv="refresh"' in p.read_text()[:2000]:
            continue
        yield ('/'.join(rel.parts[:-1])), p


TAG = re.compile(r'<meta (?:property="og:(?:image(?::[a-z]+)?|url|site_name)"|name="twitter:[a-z:]+")[^>]*>\s*'
                 r'|<link rel="canonical"[^>]*>\s*')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = set()
    for route, path in pages():
        page = path.read_text()
        head_end = page.index('</head>')
        title = meta(page, 'property', 'og:title') or plain((re.search(r'<title>(.*?)</title>', page, re.S) or [None, ''])[1])
        description = meta(page, 'name', 'description') or meta(page, 'property', 'og:description')
        url = SITE + (route + '/' if route else '')
        if route == '':
            image, alt = 'assets/social-card.jpg', 'Miami Beach coastline from the water'
        else:
            if route.startswith('events/') or route == 'julia-tuttle-cleanup':
                spec = event_card(page)
                # Older event pages were built before they had a description.
                description = description or spec['desc']
                spec.pop('desc')
            else:
                fallback = re.split(r' [|·] ', title)[0]
                spec = {'kicker': 'Miami Beach', 'headline': fallback, **PAGES.get(route, {})}
                spec.setdefault('sub', shorten(description, 110))
                spec.setdefault('alt', plain(spec['headline'].replace('*', '')) + ' · davidsuarezmb.com')
            alt = spec.pop('alt')
            slug = route.replace('/', '-')
            data = render(**spec)
            target = OUT / f'{slug}.jpg'
            if not target.exists() or target.read_bytes() != data:
                target.write_bytes(data)
            made.add(target.name)
            image = f'assets/social/{slug}.jpg'
        version = hashlib.sha256((root / image).read_bytes()).hexdigest()[:10]
        tags = (f'<meta property="og:url" content="{url}"><meta property="og:site_name" content="David Suarez · Miami Beach">'
                f'<meta property="og:image" content="{SITE}{image}?v={version}"><meta property="og:image:type" content="image/jpeg">'
                f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
                f'<meta property="og:image:alt" content="{html.escape(alt, quote=True)}"><meta name="twitter:card" content="summary_large_image">'
                f'<link rel="canonical" href="{url}">')
        if 'property="og:title"' not in page:
            tags = f'<meta property="og:title" content="{html.escape(title, quote=True)}"><meta property="og:type" content="website">' + tags
        if description and 'property="og:description"' not in page:
            tags = f'<meta property="og:description" content="{html.escape(description, quote=True)}">' + tags
        if description and '<meta name="description"' not in page:
            tags = f'<meta name="description" content="{html.escape(description, quote=True)}">' + tags
        head = TAG.sub('', page[:head_end])
        updated = head + tags + page[head_end:]
        if updated != page:
            path.write_text(updated)
    for old in OUT.glob('*.jpg'):
        if old.name not in made:
            old.unlink()
    print(f'Built {len(made)} link preview cards.')


if __name__ == '__main__':
    sys.exit(main())
