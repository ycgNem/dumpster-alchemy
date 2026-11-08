# PixelLab job log

Cap: 50 generations. Start balance 895.9 remaining (2026-11-07), floor 845.9.
v2 cap: +100 (2026-11-07). Balance 855.9 when granted, **floor 745.9**.

| # | Date | Asset | Tool | Size | Prompt (short) | Cost | Kept? | Running total |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-07 | item_cart (anchor) | create_image_pixen | 32×32, no_bg, view side, black outline, medium detail | "rusty shopping cart, side view, one bent crooked wheel, black trash bag stuffed in the basket, chunky cute game item, warm orange light from top left, purple shadows" → `dl/anchor_cart_pixen_v1.png` | 1 | No: dark purple blob, does not read as a cart (lighting/colour words swamped the shape) | 1 |
| 2 | 2026-11-07 | raccoon_gary_idle (anchor) | create_image_pixen | 48×48, no_bg, direction south, black outline, medium detail | "grumpy stocky raccoon portrait, head and shoulders bust, yellow hard hat, orange hi-vis safety vest with silver reflective stripes, scowling frown, cute chubby cheeks, black eye mask, facing viewer" → `dl/anchor_gary_pixen_v1.png` | 1 | Yes: base for Gary | 2 |
| 3 | 2026-11-07 | item_cart (anchor) | create_image_pixen | 32×32, no_bg, view side, black outline, medium detail | "shopping cart, side view, silver metal wire basket with grid, red plastic handle, four small black wheels, one wheel bent sideways, a few rust spots, game item icon" → `dl/anchor_cart_pixen_v2.png` | 1 | Reference only: right layout (handle top, wheels bottom) but the wire grid turned into grey noise and it fills the whole 32×32 | 3 |
| 4 | 2026-11-07 | item_cart (anchor, sheet test) | create_image_pixen | 128×32, no_bg, view side, black outline, medium detail | "row of four separate shopping cart game item sprites, evenly spaced, side view, silver metal wire basket with grid, red plastic handle, small black wheels, slightly rusty, trash bag in the basket" → `dl/anchor_cart_sheet_pixen_v3.png` | 1 | No (cart unreadable), but the sheet layout works: 4 separate sprites, ~30 px each, evenly spaced, 1 gen | 4 |
| 5 | 2026-11-07 | item_cart (anchor) | create_image_pixen | 28×28, no_bg, view side, black outline, **low detail** | "simple chunky cartoon shopping cart, side view, bold clear silhouette, big trapezoid basket with a few thick grey bars, red handle at the top left, two big round black wheels, flat clean shading, game item icon" → `dl/anchor_cart_pixen_v4.png` | 1 | Yes, as the layout/silhouette for the hand-finished cart (clean, reads at 1x, but small and plain) | 5 |

Style anchor run (2026-11-07): 5 generations, balance 895.90 → 890.90. Key-art cap 44, so 39 left
(floor 851.9). Plan generations reset on 2026-11-09: after that, count spend from this table, not
from the balance.
Finished in `pixel-art/anchor/build.py` → `public/art/items.*`, `public/art/cast.*`, review sheet
`art-src/review/anchor.png`.

## Full key art (director approved the anchor, 2026-11-07)

| # | Date | Asset | Tool | Size / settings | Prompt → file | Cost | Kept? | Running total |
|---|---|---|---|---|---|---|---|---|
| 6 | 2026-11-07 | item_takeout | create_image_pixen | 20×20, no_bg, side, black outline, low detail | "chinese takeout box with a plastic fork sticking out of it, game item icon" → `dl/junk_takeout_v1.png` | 1 | Shape reference only: read as a red bucket; the takeout was redrawn by hand as a kraft oyster pail | 6 |
| 7 | 2026-11-07 | item_bag | create_image_pixen | 24×24, no_bg, side, black outline, low detail | "bulging tied garbage bag leaking a drip, game item icon" → `dl/junk_bag_v1.png` | 1 | Yes: the face painted out, recoloured to the grime2 bag ramp, a drip frame added | 7 |
| 8 | 2026-11-07 | item_boot | create_image_pixen | 24×24, no_bg, side, black outline, low detail | "one old worn work boot, side view, sole peeling off, game item icon" → `dl/junk_boot_v1.png` | 1 | Yes, as drawn | 8 |
| 9 | 2026-11-07 | item_toaster | create_image_pixen | 24×24, no_bg, side, black outline, low detail | "old broken toaster with a burnt slice of toast popping out, side view, game item icon" → `dl/junk_toaster_v1.png` | 1 | Yes, plus a spark frame | 9 |
| 10 | 2026-11-07 | item_tire | create_image_pixen | 24×24, no_bg, side, black outline, low detail | "bald old car tire standing upright, front view, game item icon" → `dl/junk_tire_v1.png` | 1 | No: front-on black oval with no hole; the tire was drawn by hand (side view, rusty rim) | 10 |
| 11 | 2026-11-07 | item_mattress | create_image_pixen | 128×32 four-up, no_bg, side, black outline, low detail | "row of four separate old stained mattress game item sprites, evenly spaced, each mattress sagging and folded, springs poking out" → `dl/junk_mattress_sheet_v1.png` | 1 | Yes (variant 3): recoloured to bone ticking with blue stripes and a stain | 11 |
| 12 | 2026-11-07 | item_fridge | create_image_pixen | 128×32 four-up, no_bg, side, black outline, low detail | "row of four separate old fridge game item sprites, evenly spaced, tall fridge with its door hanging open on one hinge" → `dl/junk_fridge_sheet_v1.png` | 1 | Yes (variant 1, door hanging open): toxic eyes in the crisper, blink frame | 12 |
| 13 | 2026-11-07 | item_car | create_image_pixen | 128×32 four-up, no_bg, side, black outline, low detail, east | "row of four separate small wrecked old car game item sprites, evenly spaced, side view, flat tire, cracked windows, dented" → `dl/junk_car_sheet_v1.png` | 1 | No: cars came out 22×12, too small for tier 11 (redone as #28) | 13 |
| 14 | 2026-11-07 | item_king | create_image_pixen | 128×32 four-up, no_bg, south, black outline, low detail | "row of four separate sprites, each a chubby raccoon king sitting on a mattress throne, wearing a hubcap as a crown, holding a scepter, evenly spaced, facing viewer" → `dl/junk_king_sheet_v1.png` | 1 | Yes (variant 1) as the base: dome hat replaced by a hubcap crown, mattress throne, cape and plunger scepter added | 14 |
| 15 | 2026-11-07 | item_gull | create_image_pixen | 24×24, no_bg, side, black outline, low detail, east | "seagull standing, side view, beady eye, game sprite" → `dl/gull_gull_v1.png` | 1 | Yes, as drawn | 15 |
| 16 | 2026-11-07 | item_fatgull | create_image_pixen | 128×32 four-up, no_bg, side, black outline, low detail, east | "row of four separate very fat round seagull sprites, evenly spaced, side view, standing on tiny legs, huge belly" → `dl/gull_fatgull_sheet_v1.png` | 1 | Yes (variant 3) | 16 |
| 17 | 2026-11-07 | item_gullgang | create_image_pixen | 128×32 four-up, no_bg, side, black outline, low detail | "row of four separate sprites, each a gang of three seagulls huddled together screaming with beaks open, evenly spaced" → `dl/gull_gullgang_sheet_v1.png` | 1 | Yes (variant 3, the screaming trio; the singles were not a gang) | 17 |
| 18 | 2026-11-07 | item_gullboss | create_image_pixen | 128×32 four-up, no_bg, side, black outline, low detail, east | "row of four separate sprites, each a big tough seagull clutching a stolen bag of potato chips, evenly spaced, side view" → `dl/gull_gullboss_sheet_v1.png` | 1 | Yes (variant 3): the sack recoloured into a red chip bag | 18 |
| 19 | 2026-11-07 | item_gullgod | create_image_pixen | 128×32 four-up, no_bg, south, black outline, low detail | "row of four separate sprites, each a giant holy seagull with a glowing halo and huge spread wings, evenly spaced, facing viewer" → `dl/gull_gullgod_sheet_v1.png` | 1 | Yes (variant 1, wing tips trimmed to 32): ray/halo flicker frame | 19 |
| 20 | 2026-11-07 | truck_* | create_image_pixen | 112×64, no_bg, side, black outline, low detail, east | "garbage truck, side view, cab on the right, big boxy dump container bed on the left, chunky wheels, game sprite" → `dl/props_truck_v1.png` | 1 | Yes: cab and chassis as drawn; tall arms removed; body sheared for the 3 dump frames; hubs redrawn for the wheel frames | 20 |
| 21 | 2026-11-07 | dumpster_* | create_image_pixen | 48×48, no_bg, south, black outline, low detail | "big metal dumpster bin with a closed hinged lid, front view, dented, game sprite" → `dl/props_dumpster_v1.png` | 1 | Yes: recoloured rust with a dark plastic lid; open and rattle frames drawn by hand | 21 |
| 22 | 2026-11-07 | compactor_* | create_image_pixen | 48×48, no_bg, south, black outline, low detail | "industrial trash compactor machine, a metal box with a heavy press plate on hydraulic pistons above an open chamber, front view, game sprite" → `dl/props_compactor_v1.png` | 1 | No: too narrow; the Compactor was drawn by hand | 22 |
| 23 | 2026-11-07 | backdrop | create_image_pixen | 640×104, opaque, side, low detail | "landfill at night, wide panorama: dark sky, chain-link fence, distant piles of trash heaps silhouettes, a dirt road along the bottom" → `dl/backdrop_strip_v1.png` | 1 | No: dark, noisy, reddish; the backdrop was drawn by hand | 23 |
| 24 | 2026-11-07 | raccoon_linda_* | edit_image_pixen | 48×48 from finished Gary (`pixel-art/anchor/out/gary_idle_1x.png`) | "replace him with Linda: a slim elegant lady raccoon, no hard hat and no vest, cat-eye glasses on a beaded chain, a necklace made of bottle caps, a purple cardigan, smug raised eyebrow, same pixel art style and framing" → `dl/cast_linda_v1.png` | 1 | Yes: cat-eye glasses and bead chain added by hand, blink frame | 24 |
| 25 | 2026-11-07 | raccoon_pete_* | edit_image_pixen | 48×48 from finished Gary | "replace him with Lil' Pete: a tiny raccoon kid, no hard hat and no vest, a huge oversized red baseball cap worn backwards, huge shiny eyes, a striped t-shirt, holding up a bottle cap like a shield, same pixel art style and framing" → `dl/cast_pete_v1.png` | 1 | Yes, blink frame | 25 |
| 26 | 2026-11-07 | raccoon_mange_* | edit_image_pixen | 48×48 from finished Gary | "replace him with Grandma Mange: an old hunched grandma raccoon, no hard hat and no vest, a knitted pink shawl, tiny round reading glasses on her nose, a bald patch of missing fur on her head, a wooden cane, kind wrinkled smile, same pixel art style and framing" → `dl/cast_mange_v1.png` | 1 | Yes, blink frame | 26 |
| 27 | 2026-11-07 | possum_* | edit_image_pixen | 48×48 from finished Gary | "replace him with Inspector Possum: a grey possum with a long pointed pink snout, round ears and beady eyes, wearing a white hazmat suit with the hood down, a tiny gold badge, holding a clipboard, stern, same pixel art style and framing" → `dl/cast_possum_v1.png` | 1 | Yes (possum_idle; the hood came out up, which reads fine), blink frame | 27 |
| 28 | 2026-11-07 | item_car | create_image_pixen | 32×32, no_bg, side, black outline, low detail, east | "chunky small rusty dead hatchback car, side view, big rounded cabin, one flat tire, cracked windshield, missing bumper, game item icon" → `dl/junk_car_v2.png` | 1 | Yes: plus a tire strapped to the roof so it fills the cell | 28 |
| 29 | 2026-11-07 | raccoon_*_happy (gary, linda, pete, mange) | edit_image_pixen | 192×48 strip of the 4 finished idles (`pixel-art/cast/out/group_idle_192x48.png`) | "make all four raccoons very happy: big open-mouth grins, eyes squeezed shut in joy like upside-down U shapes, cheeks lifted; keep their outfits, hats, glasses, positions and pixel style exactly the same" → `dl/cast_moods_happy_v1.png` | 1 | Yes, 4 sprites from 1 generation (Linda's glasses and Mange's head top restored by hand) | 29 |
| 30 | 2026-11-07 | raccoon_*_angry (gary, linda, pete, mange) | edit_image_pixen | same 192×48 strip | "make all four raccoons furious: angry eyebrows slanting down hard, shouting wide-open mouths showing teeth, red flushed faces; keep their outfits, hats, glasses, positions and pixel style exactly the same" → `dl/cast_moods_angry_v1.png` | 1 | Yes, 4 sprites from 1 generation (a stray bowler hat on Mange removed) | 30 |
| 31 | 2026-11-07 | possum_dead | edit_image_pixen | 48×48 from finished possum_idle | "the same possum in the hazmat suit now playing dead: lying flat on his back sideways across the frame, four little legs sticking straight up in the air, tongue hanging out, X X eyes, clipboard dropped beside him" → `dl/cast_possum_dead_v1.png` | 1 | Yes: X eyes, tongue and legs-up added by hand | 31 |
| 32 | 2026-11-07 | possum_shutdown | edit_image_pixen | 48×48 from finished possum_idle | "the same possum in the hazmat suit, now stern and disapproving with a hard frown, holding the clipboard up high beside his face toward the viewer" → `dl/cast_possum_shutdown_v1.png` | 1 | Yes, as drawn | 32 |


Full key art (2026-11-07): 27 generations this phase (jobs 6-32), 32 in total for the key-art job
(cap 44). Balance 890.90 → 863.90 by job cost. Drawn by hand with no generation: bottle cap, crushed can,
takeout pail, tire, golden egg, bin juice, the Compactor, the backdrop, the logo, and every extra
frame (blinks, the truck's wheels and tipping bed, the Dumpster lid, sparks and glints).

## M7 critic fixes (wave 3, 2026-11-07)

Budget for this wave: at most 14 generations, floor **849.9** (balance 863.9 at the start).
USD credits untouched. Uploads went through `get_upload_url` (free).

| # | Date | Asset | Tool | Size / settings | Prompt → file | Cost | Kept? | Running total |
|---|---|---|---|---|---|---|---|---|
| 33 | 2026-11-07 | possum_idle (P2-1) | edit_image_pixen | 48×48 from finished Gary (`pixel-art/anchor/out/gary_idle_1x.png`) | "replace him with Inspector Possum, an opossum: a long pointed white cone-shaped face that narrows down to a pink nose tip, small black bead eyes, bare pink ears …, a white hazmat suit with the hood pulled down and bunched around his neck as a collar, a tiny gold badge, holding a brown clipboard, stern …" → `dl/cast_possum2_fromgary_v1.png` | 1 | No: a good possum face, but the hood came out up again (the model draws "hazmat suit" with the hood up) | 33 |
| 34 | 2026-11-07 | possum_idle (P2-1) | edit_image_pixen | 48×48 from the old possum_idle | "remove the hood: the white hood is pulled down and bunched behind his neck as a collar. Make his head an opossum's: a long pointed white snout …, small black bead eyes with no dark patches, bare pink ears instead of the black ones, grey fur on the top of the head. Keep the white hazmat suit, the badge, the clipboard …" → `dl/cast_possum2_fromold_v1.png` | 1 | Yes, the suit, clipboard and badge (rows 33 down); the head (white cone face, pink snout, eyes, brows), ears, grey neck, rolled collar, pink paw and tail drawn by hand in `pixel-art/cast/possum.py` | 34 |
| 35 | 2026-11-07 | king_portrait (P2-14) | create_image_pixen | 96×96, no_bg, south, black outline, low detail | "chubby raccoon king sitting on an old stained mattress throne, a silver hubcap worn as a crown with gold points, a red cape, holding a toilet plunger as a scepter, facing viewer, full body, game sprite" → `dl/cast_king_portrait_v1.png` | 1 | As the base for #37 (a lovely raccoon, but a gold throne, a real crown and a mace) | 35 |
| 36 | 2026-11-07 | king_portrait | edit_image_pixen | 96×96 from a 3× nearest upscale of item_king | "redraw this raccoon king as clean detailed pixel art at this size: same pose and composition …" → `dl/cast_king_portrait_edit3x_v1.png` | 1 | No: the blocky upscale stayed a muddle | 36 |
| 37 | 2026-11-07 | king_portrait | edit_image_pixen | 96×96 from #35 | "turn the golden throne into an old stained mattress folded up into an armchair throne: off-white ticking with thin blue stripes and brown stains, a spring poking out; make the crown a round silver car hubcap with small gold points around its rim; make the scepter a toilet plunger …; give him a long red cape …" → `dl/cast_king_portrait_v2.png` | 1 | Yes: the hubcap (stood on its edge like a wheel) redrawn by hand as a tilted silver disc with five gold points; greys kept on the fur ramp; a shimmer frame (`pixel-art/cast/king.py`) | 37 |
| 38 | 2026-11-07 | possum_dead | edit_image_pixen | 48×48 from the finished new possum_idle | "the same possum in the hazmat suit now playing dead: lying flat on his back sideways across the frame, head on the left, little pink paws sticking straight up in the air, tongue hanging out, X X eyes, his long pink tail limp …, clipboard dropped beside him" → `dl/cast_possum2_dead_v1.png` | 1 | No: he lay out straight with his legs pointing sideways. Drawn by hand instead (`possum_dead.py`): on his back, snout up, X eye, tongue out, four stiff legs up | 38 |
| 39 | 2026-11-07 | possum_shutdown | edit_image_pixen | 48×48 from the finished new possum_idle | "the same possum in the hazmat suit, now stern and disapproving with a hard frown, holding the clipboard up high beside his face toward the viewer; keep his white pointed face, pink ears, pink tail, collar, badge and the pixel style" → `dl/cast_possum2_shutdown_v1.png` | 1 | Yes: the collar (came out pink) back to white, a second badge removed | 39 |
| 40 | 2026-11-07 | possum_walk | create_image_pixen | 32×32, no_bg, east, side, black outline, low detail | "opossum in a white hazmat suit walking upright on two legs, side view facing right, white pointed snout, pink ears, holding a brown clipboard, long bare pink tail behind him, game sprite" → `dl/cast_possum2_walk_v1.png` | 1 | No: a muddle at 32 px (blue-tinted, pink head). Proportion reference only; the 4-frame walk is drawn by hand (`possum_walk.py`) | 40 |

M7 wave: **8 generations** (jobs 33-40), balance 863.90 → 855.90 (floor 849.9 not reached). Drawn by hand
with no generation: `possum_walk` (4 frames), `possum_dead`, `moon`, `gull_fly` (2 frames), the dirt
clean-up and the cap / can rims.

## v2 screen: scene backdrops (screen agent, 2026-11-08)

Budget: at most 12 generations, hard floor **745.9**. USD credits untouched, no SpriteCook. Balance
851.90 before this batch; 843.90 after it, but the art agent was generating at the same time, so
this batch's own cost is the 4 jobs below (1 each). Numbered S1-S4 so they don't collide with the
art agent's rows.

| # | Date | Asset | Tool | Size / settings | Prompt → file | Cost | Kept? |
|---|---|---|---|---|---|---|---|
| S1 | 2026-11-08 | backdrop_marina (boats) | create_image_pixen | 128×48, no_bg, side, east, black outline, low detail | "two small fishing boats side by side, side view, each with a hull, a small wheelhouse cabin and a short mast with rigging lines, game sprites" → `dl/backdrop_marina_boats_v1.png` | 1 | Yes: both boats, recoloured to the night ramps by value in `pixel-art/backdrop/marina.py` (the white wheelhouse windows lit sodium), sunk to the waterline, with broken reflections; used 4 times (2 at the quay, 2 in the margins) |
| S2 | 2026-11-08 | backdrop_trashmore (mountain) | create_image_pixen | 384×96, no_bg, side, black outline, low detail | "huge wide mountain of garbage and junk: old tires, trash bags, fridges, mattresses, broken furniture, a tiny throne made of junk on the very top of the summit, side view" → `dl/backdrop_trashmore_mountain_v1.png` | 1 | Yes, as texture: its dense lower band (rows 40-95) tiled over a scripted mountain outline in three night values, warmed near the summit (`trashmore.py`). Its two thrones and green hills were not used; the throne is drawn by hand |
| S3 | 2026-11-08 | backdrop_marina (lighthouse) | create_image_pixen | 36×96, no_bg, side, black outline, low detail | "tall lighthouse tower with horizontal stripes, a railed gallery and a lamp room on top, standing on a pile of rocks, side view, game sprite" → `dl/backdrop_marina_lighthouse_v1.png` | 1 | Reference only: 96 px is too tall for the 56 px sky band; redrawn by script at 34 px with its proportions (bands, gallery, lamp room, rocks) |
| S4 | 2026-11-08 | backdrop_marina (crane) | create_image_pixen | 96×96, no_bg, side, black outline, low detail | "harbor dock crane, steel lattice tower on four legs with a long angled lattice boom and a hanging hook, side view, game sprite" → `dl/backdrop_marina_crane_v1.png` | 1 | Reference only: redrawn by script as a quay crane (A-frame legs, cab, lattice boom into the sky, hook) |

Screen batch: **4 generations** (S1-S4). Drawn by script with no generation: all of Lot 9's widening
(billboard, water tower, margin junk), the Marina's far shore, water, quay, pilings, gulls, wharf
planks, harbour lantern, rowboats, crates, traps, buoys, fish bones, and Mount Trashmore's throne,
beam, heaps, bulldozer, sign and margin junk.

## v2 art: recipes, Contraband, the county map (art agent, 2026-11-08)

Budget: at most 80 generations, stop if the balance would go below **765.9** (hard floor 745.9).
USD credits untouched, no SpriteCook. Balance **851.90** before the first batch. The screen agent was
generating at the same time, so this batch's own cost is counted from the rows below (1 each).
Numbered A1... so they don't collide with the screen agent's S rows. Drafts went straight from the
job's download URL into `art-src/dl/`; #A5 and #A6 edit the previous job by its URL (no upload).

| # | Date | Asset | Tool | Size / settings | Prompt → file | Cost | Kept? |
|---|---|---|---|---|---|---|---|
| A1 | 2026-11-08 | map_bg (Mount Trashmore) | create_image_pixen | 256×192, no_bg, high top-down, black outline, low detail | "huge mountain made of piled garbage, junk and old tires, a big tattered armchair throne on the very top peak, game map landmark" → `dl/map_trashmore_v1.png` | 1 | Base for A5: a good throne, but the mountain came out as grey rock with snow |
| A2 | 2026-11-08 | map_bg (the pier) | create_image_pixen | 224×128, no_bg, high top-down, black outline, low detail | "small wooden pier jetty going out into the water, two small rowboats and one little fishing boat tied up beside it, wooden posts, game map landmark" → `dl/map_marina_v1.png` | 1 | Yes: the main pier and boats (stray dock bits dropped), one shade darker for the night |
| A3 | 2026-11-08 | map_bg (Lot 9) | create_image_pixen | 192×128, no_bg, high top-down, black outline, low detail | "small junkyard lot surrounded by a chain-link fence, a tall streetlight at one corner, a dumpster and small piles of trash inside, game map landmark" → `dl/map_lot9_v1.png` | 1 | Yes, as drawn, one shade darker, a sodium pool round its lamp |
| A4 | 2026-11-08 | map_you | create_image_pixen | 128×32 four-up, no_bg, high top-down, east, black outline, low detail | "row of four separate small beat-up pickup truck sprites with junk piled in the back, evenly spaced, game token" → `dl/map_you_sheet_v1.png` | 1 | Yes (the first, rusty one): a bounce frame and an exhaust puff added |
| A5 | 2026-11-08 | map_bg (Mount Trashmore) | edit_image_pixen | 256×192 from A1 | "make the whole mountain made of piled garbage instead of rock and snow: black and green trash bags, old tires, cardboard boxes, broken fridges and junk all the way up to the throne; no snow, no rock, no side peaks; keep the armchair throne on top …" → `dl/map_trashmore_edit_v2.png` | 1 | Base for A6: right look, too tall for the top third |
| A6 | 2026-11-08 | map_bg (Mount Trashmore) | edit_image_pixen | 256×192 → 172×128 from A5 | "the same trash mountain with the armchair throne on top, redrawn smaller at this size …" → `dl/map_trashmore_small_v3.png` | 1 | Yes: one shade darker; the throne recoloured red velvet and gold by hand; the beam, the foothill heaps drawn here |
| A7 | 2026-11-08 | map_bg (the bait shack) | create_image_pixen | 128×96, no_bg, high top-down, black outline, low detail | "small wooden bait shack on stilts with a little porch, stacked fish crates, a coiled rope and a lamp post beside it, game map landmark" → `dl/map_shack_v1.png` | 1 | Yes: its grass tile cut away so it stands on the map's ground, one shade darker |
| A8 | 2026-11-08 | map_bg (Mount Trashmore) | edit_image_pixen | 172×128 → 184×88 from A6 | "the same trash mountain with the armchair throne on top, redrawn wider and lower at this size: a broad heap of trash bags, tires, boxes and fridges, the throne still on the peak …" → `dl/map_trashmore_wide_v4.png` | 1 | Yes, replaces A6: the map scene's top bar covers stage y 0-24, so the throne had to sit lower without the mountain reaching the road band |
| A9 | 2026-11-08 | map_bg (Lot 9) | edit_image_pixen | 192×128 → 136×88 from A3 | "the same fenced junkyard lot with its streetlight, dumpster and crate, redrawn smaller at this size …" → `dl/map_lot9_small_v2.png` | 1 | Yes, replaces A3 (moved to the top-left, where the Contraband slots don't cover it): a stray tile dropped, the lamp's arm and bulb redrawn by hand |

Art batch: **9 generations** (A1-A9), all 1 each. Balance 851.90 → 795.90 over the same time, but
**not by us**: the director checked `list_images` on 2026-11-08 and the other ~47 were about 44 neon
glyph/icon sprites and a "void creature" from another project on the same PixelLab account.
The account is shared, so **count this build's spend from this log, not the balance**. v2 so far:
13 (S1-S4, A1-A9) of the 100 granted; the build's total is 53 of 150. USD credits untouched
($2.00). Kept: A2, A4, A7, A8, A9 (A1, A5 and A6 were steps toward A8; A3 was replaced by A9).

Two more requests ("bait shack" and "row of small junk piles") were refused by the rate limit
(10 jobs at once, shared with the screen agent) and cost nothing.

Drawn by script with no generation: all 20 recipe results (`pixel-art/recipes/build.py`, built
from the finished junk, gull and cart sprites plus hand-drawn parts), all 25 Contraband stickers
(`pixel-art/contraband/build.py`), and on the map the sky, hills, sea, lighthouse, ground, quay,
water, lamps, light pools, fence, junk heaps, toxic puddle, the beam, the four node badges and the
four reward tags (`pixel-art/map/build.py`).

## v2 polish: Mount Trashmore made huge (polish agent, 2026-11-08)

Budget: at most 4 generations. USD credits untouched ($2.00), no SpriteCook. Balance 795.90 before,
793.90 after (the account is shared, so count from these rows). Numbered P1... so they don't
collide with the S and A rows.

| # | Date | Asset | Tool | Size / settings | Prompt → file | Cost | Kept? |
|---|---|---|---|---|---|---|---|
| P1 | 2026-11-08 | backdrop_trashmore (mountain body) | create_image_pixen | 768×340, side, black outline, low detail, seed 4108 | "a huge heap of garbage filling the whole frame edge to edge: piled black and green trash bags, old car tires, white fridges lying on their sides, striped mattresses, cardboard boxes, a broken sofa, side view" → `dl/backdrop_trashmore_heap_v2.png` | 1 | Yes, as texture: shrunk 3x (an outline-keeping block pick) for the mountain, 2x for the near heaps, remapped by value into the night ramps in `pixel-art/backdrop/trashmore.py` |
| P2 | 2026-11-08 | backdrop_trashmore (mountain body) | create_image_pixen | 768×340, side, black outline, low detail, seed 5219 | "a dense pile of junk filling the whole frame edge to edge: stacked old mattresses, white fridges and washing machines, piles of car tires, black trash bags, broken wooden chairs, a rusty shopping cart, side view" → `dl/backdrop_trashmore_heap_v3.png` | 1 | Yes, as texture: shrunk 4x, laid in patches over P1 so the mountain shows fridges, washers and mattress slabs among the bags |

Polish batch: **2 generations** (P1-P2). Drawn by script with no generation: the mountain's outline
(a dome from the far-left margin to a summit at stage (492, -40)), the junk poking out of the ridge,
the HUD darkening, the throne's warm light, the red velvet throne, the beam, the gulls, and the
near heaps' layout. v2 total: 15 (S1-S4, A1-A9, P1-P2).
