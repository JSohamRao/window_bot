# Canonical THUKUNA character specification

Reference: `current_canonical_base.png`, copied byte-for-byte from the current
production sprite `assets/thukuna/01_idle_base.png`.

## Identity lock

- **Overall proportions:** Extremely oversized, almost circular head above a
  tiny cursed-creature torso. The head and hair dominate roughly three quarters
  of the visible character. The compact body reads as crawling/squatting, not as
  a normally proportioned humanoid.
- **Head/body ratio:** Preserve the current giant-head/tiny-body relationship in
  every pose. Never lengthen the torso or legs to make an ordinary chibi person.
- **Hair silhouette:** Dense radial crown of short, irregular, sharp spikes.
  Keep the asymmetrical tuft rhythm and broad round crown; no long locks, fades,
  undercuts, or alternate hairstyle.
- **Hair color:** Dusty salmon/pink-red with muted rose shadows and warm pale
  highlights. Avoid bright magenta, brown, or neon red.
- **Eyes:** Small, intense red irises/pupils in pale sclera, outlined darkly.
  Narrow lids and brows create the gleefully cursed stare. Blink frames alter
  only lid openness, not eye placement or design.
- **Forehead marking:** Centered black forked/diamond-like curse mark above the
  brows. Shape, orientation, and position remain stable.
- **Facial markings:** Symmetrical black markings at cheeks/temples plus the
  central nose marking and dark chin/jaw accents. Do not add, omit, or relocate
  marks between frames.
- **Grin and mouth:** Enormous black open-mouth grin is the identity focal point.
  It has a rounded triangular cavity, visible red tongue/lower mouth, and a
  mischievous, goofy rather than realistic expression.
- **Teeth:** Two prominent blocky white upper front teeth/fangs at the center,
  with the existing simplified cartoon tooth language. No realistic dentition.
- **Scarf/collar:** Deep muted crimson wrap around the neck, broad and folded,
  with dark burgundy shadows. It must remain present and visually consistent.
- **Body/outfit:** Small peach-toned cursed body with the same minimal clothing
  treatment visible below the scarf. Do not invent armor, robes, shoes, jewelry,
  tattoos, or props.
- **Limbs:** Short, soft, tapered arms and legs ending in exaggerated black
  pointed claws. Preserve the current thickness and tiny-body scale even when
  limbs extend for locomotion.
- **Outline:** Bold near-black anime/cartoon contour with slightly varied line
  weight. Interior features use the same crisp dark ink language.
- **Shading:** Polished 2D cel shading with soft blended transitions used only to
  describe the existing volumes. Highlights are warm and restrained; no 3D,
  painterly, pixel-art, or flat-vector reinterpretation.
- **Palette:** Warm peach skin, dusty salmon hair, crimson scarf, vivid red eyes,
  black markings/mouth/claws, white teeth/sclera, and burgundy/rose shadows.
- **Expression language:** Delighted menace, cursed mischief, and broad goofy
  theatricality. Emotional variants must still be recognizable as the same face.
- **Pose language:** Low, compact, creature-like, springy, and claw-led. Ground
  poses feel planted even with the huge head; air poses compress or extend the
  tiny body without changing anatomy.

## Frame-level invariants

Transparent square canvas; complete relevant body/effects visible; no scenery,
text, labels, border, watermark, UI, or baked shadow. Within a sequence, maintain
stable camera, orientation, head size, palette, rendering style, and nominal
character scale. Only pose/expression/effects required by the current temporal
step may change.
