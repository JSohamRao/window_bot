# THUKUNA generation prompt system

## Identity-preserving prefix (apply to every new frame)

Edit the supplied canonical THUKUNA reference into one animation frame. Preserve
the exact same character identity: enormous round head and tiny cursed-creature
body, dusty salmon spiky-hair silhouette, red eyes, fixed black forehead/nose/
cheek/chin curse markings, enormous black goofy grin with two blocky white front
teeth and red tongue, deep crimson scarf, peach limbs with black claws, bold
near-black anime outline, and the same polished 2D cel shading and palette. This
is pose animation of the existing design, not a redesign. Keep a consistent
front three-quarter camera, character scale, and framing unless the pose requires
a small compositional adjustment. Square transparent RGBA canvas. Complete body
visible. No background, floor, scenery, wall, UI, text, label, frame number,
watermark, border, or baked drop shadow. Do not make him taller, humanoid,
realistic, generic Sukuna, or change hair, markings, scarf, outfit, anatomy, or
rendering style.

## Negative consistency clause (apply to every new frame)

Reject extra fingers/limbs/teeth, missing claws/markings/scarf, cropped anatomy,
random perspective changes, altered head size, unrelated effects, opaque or
checkerboard backgrounds, and any style drift. Adjacent frames are a coherent
temporal sequence, not unrelated poses.

## Batch prompts

1. **Idle / Blink (4):** `idle_01` is the unchanged canonical reference;
   `idle_02` is a tiny breathing rise/compression while retaining the cursed
   grin; `blink_01` closes the eyelids almost fully while everything else remains
   still; `blink_02` reopens the eyes halfway-to-mostly-open between the closed
   and canonical states. Movement is deliberately subtle.
2. **Crawl (8):** Low planted crawl cycle: right-side contact, compression,
   push, passing, opposite contact, compression, push, passing. Stable head/body
   height and scale; continuous alternating limbs; loop frame 8 into frame 1.
3. **Sprint (6):** Dedicated frantic running/crawling cycle with stronger forward
   lean, larger claw/limb extension, compression, airborne passing, opposite
   contact, and recovery. Aggressive delighted face; not sped-up crawl art.
4. **Jump (10):** Anticipation, deep crouch, takeoff, early ascent, ascent,
   compact apex, descent, stronger descent, ground impact, recovery. Pose only;
   no drawn trajectory or ground.
5. **Hop (10):** Small crouch, playful anticipation, light takeoff, low airborne,
   tucked airborne, brief apex, descent, near-ground, soft impact, recovery.
   Quicker/lower/goofier than Jump.
6. **Fall / Land (6):** Fall, stronger fall, goofy panic, pre-impact brace,
   compressed impact, recovery. Physical falling, not the comedic Fall Over.
7. **Climb (10):** Enter invisible edge, grip, pull, alternate grip, push,
   alternate pull, grip, climb, endpoint, exit. Hands and body align to an
   invisible vertical edge; suitable for horizontal mirroring; draw no wall.
8. **Perch (6):** Approach invisible horizontal edge, lower, sit, settle, perch
   idle, exit/recovery. Final pose visibly sits rather than using ground idle.
9. **Sleep / Wake (8):** Tired, lowering, lie down, asleep, breathing asleep,
   wake, rise, recovered idle. Continuous transition; no instant pose swap.
10. **Watch Cursor (4):** Neutral, eye shift, small head turn, intense stare.
    Keep body motion tiny and eye anatomy canonical.
11. **Laugh (3):** Laugh start, wider open-mouth laugh, peak full-body laugh.
    Preserve the distinctive mouth/teeth rather than inventing a new mouth.
12. **Angry (6):** Notice, annoyed, tense, angry, peak angry, settle. Escalate
    through posture/brows while retaining identity and canonical color.
13. **Rage (9):** Rage entry, escalation, tension, stronger rage, peak, shake A,
    shake B, exit, recovery. Visibly stronger than Angry; never a mere recolor.
14. **Fall Over (6):** Lose balance, tip, tumble, comedic impact, lying stunned,
    recover. Distinct from gravity falling and temporally readable.
15. **Domain Expansion (20):** Freeze, expression change, charge, stronger
    charge, dialogue-ready, aura start, aura grows, energy build, expansion
    start, expand, stronger expansion, intensity, near peak, peak, peak hold,
    collapse begins, collapse, dissipate, recovery, idle return. Local transparent
    crimson/dark-red/black cursed energy only; no scenery; never obscure THUKUNA.

Each individual generation request appends exactly one frame description to the
identity prefix and negative clause. Always reference the canonical base directly.
