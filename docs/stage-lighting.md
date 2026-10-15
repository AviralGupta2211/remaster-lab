# Stage lighting design

How the *Stage* scene in the Video view is designed, and why. The reference point is the large arena-rock shows of the late 1980s and 1990s, the Pink Floyd tours lit by Marc Brickman in particular (*A Momentary Lapse of Reason*, 1987–89, and *The Division Bell*, 1994, filmed as *Pulse*). Nothing here copies those shows. It borrows their way of thinking: a light show built as a performance with a beginning, middle and climax, not a set of effects that fire whenever the music is loud.

## What the real shows did

From interviews and production write-ups (sources at the end):

- **A shape, not a pile of lamps.** The 1994 stage sat under a 40 m arch modelled on the Hollywood Bowl band shell, designed by Mark Fisher. Brickman said the Bowl reminded him of a planetarium, with stars. The arch itself was the light fixture.
- **Black box, then reveal.** On the 1987 tour, Brickman and Paul Staples avoided the usual overhead rows of PAR cans. A "black box" let effects appear out of nowhere, "like a magic show".
- **Big, static beam sculptures.** Brickman preferred lasers as "very big, architectural-type monolithic structures over the stage" to scanned graphics. In 1994 he used two copper-vapour lasers with 42 mm beams, so thick they read as solid rods in the haze: green at 511 nm, yellow at 578 nm (together a gold or lime), and a 620 nm red dye laser. They were used as mirror-bounced beam webs, slow searchlight sweeps over the crowd, single-axis scans, and rotating gratings near the end. There were no laser graphics.
- **Light that follows the music, note by note.** In *Wish You Were Here*, beams were added to the web on guitar notes. Gilmour wanted the band to trigger lights from their instruments.
- **Pods that follow the soloist.** On the 1987 tour, four 8-foot pods rode trolleys along the truss and travelled with Gilmour during solos, keeping their lights on him.
- **The round screen and its ring.** "Mr Screen", a circular projection screen ringed with Vari*Lites (28 VL3s in 1987), whose ring was spun in colour into flower-, iris- and sun-like looks.
- **Effects saved for one moment.** The 16-foot mirror ball rose from the crowd and opened up during *Comfortably Numb*. Reviews of the 1994 Earls Court shows single out that moment, the pyro and the plane crash, because each happened once.
- **Searchlights.** Four Xenon "Xescans" at front of house, chosen to look like helicopter searchlights.

## The rules we took from that

1. **Plan the whole song before lighting any of it.** A cue is written for every section, and an arc is drawn for the whole song. The climax is the loudest section after the first 40% of the song.
2. **Spend each big effect once, late, and on purpose.** The arch stays dark until the music first lifts (the reveal). Lasers arrive as a static web and escalate to sweeps and scans in later big sections. The grating and the mirror ball are kept for the climax, and pyro for the single biggest jump in energy.
3. **Architecture first.** The arch ribs, the screen ring and the perimeter beams hold still shapes (columns, sunburst, crossing overhead, a cathedral converging above the hall) and crossfade between them on cues. Movement belongs to the pods, the searchlights and the lasers.
4. **Follow the player.** The brightest stem gets the follow spot. In solo sections (the *other* stem leads) and at the climax, the pods ride to that player and keep their beams on them. In laser-web sections, each note of the *other* stem adds a beam.
5. **Darkness is a tool.** Calm sections get stars on the arch and deep blue. The half-beat before a hit goes black. *Spot* cues drop everything to one follow spot.
6. **Restraint with strobe.** Strobe is used only in the last big section and on hits, and it is rate-limited: *Safe* (the default) allows at most 3 flashes in any second.

## What the scene draws

| Rig element | Real-world counterpart | Driven by |
| --- | --- | --- |
| 5 arch ribs × 44 lamps | the band-shell arch | the cue's pattern: stars (calm), chase, pulse (rib by rib outward on the beat), fill (climax), reveal (fills from the centre over 4 beats) |
| Round screen + 28-lamp ring | the circular screen and its Vari*Lite ring | iris (calm), flower (spun in colour, mid), sun (big); the screen shows the Orbit or Tunnel scene |
| 24 perimeter beam lights | Telescans on the arch | static looks per cue, crossfaded over 2 beats; hard white in big sections, colour elsewhere |
| 4 pods × 6 lights on trolleys | the 1987 pods | parked (calm), sweeping in tempo (mid/big), travelling to the soloist (solo, climax) |
| 4 searchlights at front of house | Xescans | slow sweeps in the intro and a big finale |
| 2 follow spots | follow spots | the lead stem, or the soloist |
| Lasers: web, search, scan, grating | the copper-vapour and dye lasers | web grows with the notes of the *other* stem and turns from yellow to lime halfway through; the grating rotates at the climax with red beams |
| Mirror ball | the opening mirror ball | climax only: rises over 4 bars, opens its petals, throws up to 700 reflections that turn with it |
| Pyro | flash pots | once, at the biggest jump in energy |
| Blinders, strobe | blinders, strobes | hits; strobe rate-limited |
| Crowd | the audience | nodding on the beat, hands up at hits and the climax, phone lights in calm sections and under the mirror ball |

The colour default is *Classic*: deep blue and indigo when calm, reds and ambers in between, white beams with green and yellow lasers when big, and gold for the climax. *From key*, *Warm*, *Ice* and *Rainbow* are alternatives.

## Rendering

- The rig is modelled in metres (x to stage right, y up, z toward the audience) and projected through a camera.
- **Camera**: concert-film shots cut on the bar. *Wide* is from the mixing desk, then *high* (crane), *crowd*, *side*, and *close* on the soloist. The sequence depends on the cue's role, and a hit always cuts to wide. You can also pick *Wide* or *Crowd*.
- **Beams** are drawn into a half-resolution light buffer as soft two-layer cones that fade along their length, with pools where they hit the floor. Beams aimed into the lens are attenuated so they don't white out the frame.
- **Haze** is a drifting noise mask applied to the light buffer, so beams break up as they would in real haze.
- **Bloom** shrinks the light buffer to 160×90 and 40×23 and adds it back.
- **Lamps and glows** use cached glow sprites. The crowd is drawn in batched paths.
- About 35–45 fps in a headless browser with software rendering; a normal browser with GPU canvas runs at the display rate.

## Next steps

- **Your own cues**: edit any cue (look, lasers, camera) on the desk and save it with a version, the same way remaster settings are saved.
- **Better solo detection**: with 6-stem separation, the guitar gets its own stem, so pods and laser webs can follow the guitar specifically.
- **Real lights**: send the cue list over DMX (Art-Net or sACN) so a home rig or a small venue can run this show.
- **Song meaning** (Video v2): looks chosen from lyrics and mood, not only loudness and structure.

## Sources

- [Marc Brickman interview, 1988 (Pink Floyd and Co.)](https://pfco.neptunepinkfloyd.co.uk/band/interviews/other/otherbrick.html)
- [Pink Floyd on Tour: the 1994 lasers (LaserFX)](https://www.laserfx.com/Backstage.LaserFX.com/Archives/Archives7.html)
- [Pink Floyd's lasers light up the sky (Spare Bricks)](https://sparebricks.fikat.org/sbzine15/features2.html)
- [Marc Brickman, lighting designer, part two](https://talesfromthebraziersgrotto.wordpress.com/2026/04/09/marc-brickman-lighting-designer-part-two-from-my-archives/)
- [Pink Floyd Division Bell gallery (Live Design)](https://www.livedesignonline.com/special-report/pink-floyd-division-bell-gallery)
- [The Division Bell Tour (Wikipedia)](https://en.wikipedia.org/wiki/The_Division_Bell_Tour)
- [Mr. Screen evolves into Mr. LED (PLSN)](https://plsn.com/articles/production-profile/mr-screen-evolves-into-mr-led/)
- [1994 Earls Court show reviews (Brain Damage)](https://www.brain-damage.co.uk/concerts/pink-floyd-1994-earls-court-show-reviews.html)
