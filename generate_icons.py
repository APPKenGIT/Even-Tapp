import math
from PIL import Image, ImageDraw, ImageFilter

def create_eventapp_icon(size=1024):
    # Render at 2x for supersampling (2048x2048 canvas)
    canvas_size = size * 2
    s = canvas_size / 1024.0

    # 1. Base Image: Rich Emerald Gradient (#044e39 to #0d7a58)
    img = Image.new("RGBA", (canvas_size, canvas_size))
    pixels = img.load()

    # Lighting origin in upper-left (center: 360*s, 240*s)
    lx, ly = 360 * s, 240 * s

    for y in range(canvas_size):
        ny = y / canvas_size
        for x in range(canvas_size):
            # Linear depth: top is luminous emerald, bottom is deep forest
            r0 = 10 * (1 - ny) + 4 * ny
            g0 = 152 * (1 - ny) + 70 * ny
            b0 = 108 * (1 - ny) + 50 * ny

            # Ambient radial light cone
            d = math.hypot(x - lx, y - ly)
            light = max(0.0, 1.0 - (d / (960 * s))) ** 1.5

            r = min(255, int(r0 + light * 24))
            g = min(255, int(g0 + light * 64))
            b = min(255, int(b0 + light * 46))

            pixels[x, y] = (r, g, b, 255)

    # Ambient subtle energy rings in background
    rings = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(rings)
    arc_center = (int(512 * s), int(512 * s))
    for arc_r in [410 * s, 460 * s]:
        bbox = [arc_center[0] - arc_r, arc_center[1] - arc_r, arc_center[0] + arc_r, arc_center[1] + arc_r]
        r_draw.ellipse(bbox, outline=(255, 255, 255, 20), width=int(3 * s))
    img = Image.alpha_composite(img, rings)

    # 2. Central Calendar Card
    # Dimensions: 570 x 590
    cw = 570 * s
    ch = 590 * s
    cx0 = (canvas_size - cw) / 2
    cy0 = (canvas_size - ch) / 2 - 10 * s
    cx1 = cx0 + cw
    cy1 = cy0 + ch
    cr = int(98 * s)

    # Deep Drop Shadow for floating 3D appearance
    shadow = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_off_y = 42 * s
    s_box = [cx0 + 10 * s, cy0 + s_off_y, cx1 - 10 * s, cy1 + s_off_y]
    s_draw.rounded_rectangle(s_box, radius=cr, fill=(2, 35, 22, 190))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(30 * s)))
    img = Image.alpha_composite(img, shadow)

    # Ambient soft secondary shadow
    amb = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    amb_draw = ImageDraw.Draw(amb)
    amb_box = [cx0 - 10 * s, cy0 + 20 * s, cx1 + 10 * s, cy1 + 45 * s]
    amb_draw.rounded_rectangle(amb_box, radius=cr, fill=(1, 26, 16, 120))
    amb = amb.filter(ImageFilter.GaussianBlur(radius=int(52 * s)))
    img = Image.alpha_composite(img, amb)

    # Card Body: Pure porcelain white
    card = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle([cx0, cy0, cx1, cy1], radius=cr, fill=(255, 255, 255, 255))

    # Calendar Header: Vibrant emerald banner
    header_h = 165 * s
    h_mask = Image.new("L", (canvas_size, canvas_size), 0)
    hm_draw = ImageDraw.Draw(h_mask)
    hm_draw.rounded_rectangle([cx0, cy0, cx1, cy1], radius=cr, fill=255)
    
    h_cut = Image.new("L", (canvas_size, canvas_size), 0)
    hc_draw = ImageDraw.Draw(h_cut)
    hc_draw.rectangle([0, 0, canvas_size, cy0 + header_h], fill=255)

    from PIL import ImageChops
    final_h_mask = ImageChops.multiply(h_mask, h_cut)

    # Header gradient: #059669 -> #047857
    h_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    h_pix = h_img.load()
    y_start, y_end = int(cy0), int(cy0 + header_h)
    for y in range(y_start, y_end + 1):
        prog = (y - y_start) / max(1, (y_end - y_start))
        r = int(16 * (1 - prog) + 4 * prog)
        g = int(185 * (1 - prog) + 120 * prog)
        b = int(129 * (1 - prog) + 87 * prog)
        for x in range(int(cx0), int(cx1) + 1):
            h_pix[x, y] = (r, g, b, 255)

    card.paste(h_img, (0, 0), final_h_mask)

    # 2 Sleek Circular Calendar Binder Grommets in the header
    grommet_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grommet_layer)

    grommet_y = cy0 + 82 * s
    r_outer = 25 * s
    r_inner = 13 * s

    for gx in [cx0 + 135 * s, cx1 - 135 * s]:
        # Outer platinum ring
        g_draw.ellipse([gx - r_outer, grommet_y - r_outer, gx + r_outer, grommet_y + r_outer],
                       fill=(255, 255, 255, 245), outline=(226, 232, 240, 255), width=int(2 * s))
        # Inner cutout hole
        g_draw.ellipse([gx - r_inner, grommet_y - r_inner, gx + r_inner, grommet_y + r_inner],
                       fill=(3, 75, 54, 255))
        # Metallic glint
        g_draw.ellipse([gx - 3 * s, grommet_y - r_outer + 4 * s, gx + 3 * s, grommet_y - r_outer + 10 * s],
                       fill=(255, 255, 255, 210))

    card = Image.alpha_composite(card, grommet_layer)
    img = Image.alpha_composite(img, card)

    # 3. Checkmark & Even'Tapp Pulse
    body_mid_y = cy0 + header_h + (ch - header_h) / 2.0
    
    # Checkmark points:
    # Slightly adjusted so the entire pulse waves sit harmoniously on the white card
    p1 = (cx0 + 130 * s, body_mid_y - 20 * s)
    p2 = (cx0 + 225 * s, body_mid_y + 80 * s)
    p3 = (cx0 + 405 * s, body_mid_y - 110 * s)
    stroke_w = int(54 * s)

    # Checkmark soft shadow on card
    chk_s = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    chk_s_draw = ImageDraw.Draw(chk_s)
    cs_y = 12 * s
    chk_s_draw.line([(p1[0], p1[1] + cs_y), (p2[0], p2[1] + cs_y), (p3[0], p3[1] + cs_y)],
                    fill=(4, 120, 87, 50), width=stroke_w, joint="round")
    chk_s = chk_s.filter(ImageFilter.GaussianBlur(radius=int(9 * s)))
    img = Image.alpha_composite(img, chk_s)

    # Checkmark body: Vibrant Emerald (#10B981)
    chk = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    chk_draw = ImageDraw.Draw(chk)
    chk_draw.line([p1, p2, p3], fill=(16, 185, 129, 255), width=stroke_w, joint="round")

    # Round cap circles
    hw = stroke_w / 2.0
    chk_draw.ellipse([p1[0] - hw, p1[1] - hw, p1[0] + hw, p1[1] + hw], fill=(16, 185, 129, 255))
    chk_draw.ellipse([p3[0] - hw, p3[1] - hw, p3[0] + hw, p3[1] + hw], fill=(16, 185, 129, 255))
    chk_draw.ellipse([p2[0] - hw, p2[1] - hw, p2[0] + hw, p2[1] + hw], fill=(16, 185, 129, 255))

    img = Image.alpha_composite(img, chk)

    # 4. "Tapp" Pulse Waves at checkmark peak p3
    tap = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    tap_draw = ImageDraw.Draw(tap)
    tcx, tcy = p3[0], p3[1]

    # Outer wave
    r_wave2 = 92 * s
    tap_draw.ellipse([tcx - r_wave2, tcy - r_wave2, tcx + r_wave2, tcy + r_wave2],
                     outline=(52, 211, 153, 130), width=int(6 * s))

    # Inner wave
    r_wave1 = 56 * s
    tap_draw.ellipse([tcx - r_wave1, tcy - r_wave1, tcx + r_wave1, tcy + r_wave1],
                     outline=(16, 185, 129, 210), width=int(8 * s))

    # Glowing center touch button / beacon
    r_beacon = 26 * s
    tap_draw.ellipse([tcx - r_beacon, tcy - r_beacon, tcx + r_beacon, tcy + r_beacon],
                     fill=(52, 211, 153, 255), outline=(255, 255, 255, 255), width=int(5 * s))

    # Spark center dot
    r_spark = 10 * s
    tap_draw.ellipse([tcx - r_spark, tcy - r_spark, tcx + r_spark, tcy + r_spark], fill=(255, 255, 255, 255))

    img = Image.alpha_composite(img, tap)

    # 5. Three event status dots at bottom of card
    dots = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    dots_draw = ImageDraw.Draw(dots)
    dot_y = cy1 - 55 * s
    dot_r = 9 * s
    dot_spacing = 40 * s
    dot_colors = [(16, 185, 129, 240), (52, 211, 153, 240), (203, 213, 225, 220)]
    for i, col in enumerate(dot_colors):
        dx = (512 * s) + (i - 1) * dot_dist if False else (512 * s) + (i - 1) * dot_spacing
        dots_draw.ellipse([dx - dot_r, dot_y - dot_r, dx + dot_r, dot_y + dot_r], fill=col)

    img = Image.alpha_composite(img, dots)

    # Downsample with Lanczos for razor-sharp antialiasing
    return img.resize((size, size), Image.Resampling.LANCZOS)

if __name__ == '__main__':
    print("Generating Even'Tapp icon 512x512...")
    icon_512 = create_eventapp_icon(512)
    icon_512.save("icon-512.png", "PNG", optimize=True)

    print("Generating Even'Tapp icon 192x192...")
    icon_192 = icon_512.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save("icon-192.png", "PNG", optimize=True)

    print("Generating apple-touch-icon.png 180x180...")
    icon_apple = icon_512.resize((180, 180), Image.Resampling.LANCZOS)
    icon_apple.save("apple-touch-icon.png", "PNG", optimize=True)

    print("Generating favicon-32.png...")
    icon_32 = icon_512.resize((32, 32), Image.Resampling.LANCZOS)
    icon_32.save("favicon-32.png", "PNG", optimize=True)

    print("Generating favicon.ico...")
    icon_512.save("favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    print("Generating maskable icon...")
    icon_maskable = icon_512.resize((512, 512), Image.Resampling.LANCZOS)
    icon_maskable.save("icon-maskable-512.png", "PNG", optimize=True)

    print("Done generating all icon assets!")
