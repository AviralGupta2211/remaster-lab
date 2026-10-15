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
2. **Spend each big effect once, late, and on purpose.** The arch stays dark until the first big section that starts at least 20% into the song (the reveal). Inside the black box the order is the film's: searchlights, then an amber laser web over a deep-blue stage. Later big sections escalate the lasers to sweeps and scans. The grating and the mirror ball are kept for the climax, and pyro for the single biggest jump in energy.
3. **Hold the reveal, then snap it.** The first big section opens on white specials only. Eight bars in (or 60% of a shorter section) the stage goes almost black for one bar, then every arch lamp comes on at once, blows out the camera and settles in about half a second.
4. **Architecture first.** The arch ribs, the screen ring and the perimeter beams hold still shapes (columns, sunburst, crossing overhead, a cathedral converging above the hall) and change between them on cues. Movement belongs to the pods, the searchlights and the lasers.
5. **The cue sets the level, not the loudness.** Brightness comes from the cue (black box about a third of the lit show) with only a quarter of it following the music's loudness. Verses hold their look and change it every 4 bars. Solos and big sections bump on the beat and change colour every bar.
6. **Snap on, fall slowly.** A bump reaches full in two video frames (83 ms) and falls about twice as slowly: 170 ms in solos and the finale, half a beat in verses. Cue changes snap on the section boundary. Only the black box crossfades, over a bar.
7. **Follow the player.** The brightest stem gets the follow spot. In solo sections (the *other* stem leads) and at the climax, the pods ride to that player and keep their beams on them. In laser-web sections, each note of the *other* stem adds a beam.
8. **Darkness is a tool.** Calm sections get stars on the arch and deep blue. The bar before the reveal goes black. *Spot* cues drop everything to one follow spot.
9. **Restraint with strobe.** No strobe or blinders before the reveal. Strobe is used in the last big section and on hits after that, locked to the eighth-note grid as in the film. *Safe* (the default) still allows at most 3 flashes in any second; *Off* (and reduced motion) also stops the finale's alternating looks.

## Measured from the Pulse film

To check the rules against the real show, we measured one song from the *Pulse* concert film (Earls Court, 1994): *Another Brick in the Wall (Part 2)*, 6:54, 1080p at 24 fps, from a restored and re-edited copy. The footage stays on the owner's computer and is not in this repo.

**Method.** `ffmpeg` decoded every frame to 64×36 and 96×54 pixels. For each frame we computed mean and 95th-percentile brightness, the share of blown-out (>85%) and black (<6%) pixels, saturation and a 12-bin hue histogram of the coloured pixels. Camera cuts were found where both the brightness pattern and the edge pattern of consecutive frames stop correlating (that separates a cut from a light change). The audio track went through librosa for beats (103 BPM), onset strength, loudness and sections. Light changes were measured inside shots only, so a cut never counts as a light cue. Contact sheets every 2 seconds, and every frame around the reveal and the finale, were checked by eye.

| What | Measured | What the Stage scene now does |
| --- | --- | --- |
| Black box | First 103 s (25%): 60–90% of each frame is black. Searchlights only from 0:14, the laser web from 0:38 over a deep-blue stage, white specials from 1:24 | Cues before the reveal: searchlights, then an amber web over a blue wash; arch only faint stars; level 0.4 |
| Reveal | 1:24 is the loudest section so far but stays dark. At 1:40 a bar (2.5 s) of near-black, then at 1:43 the whole gold arch snaps on: peak in 0.25 s, 90% settled in 0.58 s. Loudness is the same before and after | Reveal held 8 bars into the first big section, a black bar, then all lamps at once with a warm blow-out that decays with a 0.25 s time constant |
| Brightness vs loudness | Correlation over 2 s windows: r = 0.27 | Cue level × 0.75 + loudness × 0.25 |
| Rise and fall | Inside shots, light rises take a median 83 ms (10–90%, 56% within two frames); falls take 167 ms, and 292 ms (half a beat) in the verses. The black box crossfades over 1–7 s | Bump: 83 ms on; 170 ms off in solos and big sections, half a beat in verses; black box fades over a bar |
| Light vs beat | In the solos, brightness rises lag onsets by one frame (≤ 42 ms). In the verses the cross-correlation is flat: the look holds | Bumps at full strength in solos, climax and big sections; 35% in verses |
| Look changes | Verses: one colour change every 14.6 beats (about 4 bars). Solo 1: every 3.4 beats. Solo 2: every 5 | Verses swap main and accent every 4 bars; solos step through six colours every bar |
| Section boundaries | Look changes land on the music's section boundary to within 0.1 s (1:24.2 vs 1:24.2, 6:19.5 vs 6:19.6), with no anticipation | Cue changes snap at the boundary |
| Palette | Black box: 93–97% of coloured light is blue/azure; searchlights cool white. After the reveal: 93% warm (amber, gold, red-orange). Solos: magenta, cyan, green, red, violet, yellow alternating, warm and cool about even. Finale: white beams over an amber floor with blue lamps on the arch | *Classic* palette rebuilt on those numbers |
| Flashes | None before the reveal. About 11 a minute in the verses, 17 a minute in the solos. Finale (last 30 s): 161 a minute, on an eighth-note period (0.29 s), at most 5 in any second | No strobe before the reveal; finale strobe on the eighth-note grid; *Full* follows it, *Safe* caps at 3/s |
| First appearances | Searchlights 3% in, lasers 9%, arch 25%, saturated colour 58% (the solo), strobe chase 92% | Same order |
| Camera | Shots: median 2.44 s (1 bar), 10th–90th percentile 1.3–4.4 s. Cuts land 157 ms from the nearest beat on median, no closer than chance: the editor cut near the bar, not on the beat. Black-box intro: long shots joined by 1–2 s dissolves. Solos: mostly close-ups of the guitar. Finale: wide shots of 5.7, 10.4 and 14 s | A shot list planned per song: about one bar per shot with ½–2 bar variation and ±0.15 s jitter; long shots in the black box and the finale; close-ups in solos; wide on the reveal and on hits |

**Limits.** This is one song from one show, filmed and edited for video, so the edit and the camera's auto-exposure shape some of the numbers (the reveal's blow-out is partly the camera). Close-ups count toward the palette (skin tones push "warm" up). The lasers are thin, so they barely register in the hue statistics; their colour was read by eye from the frames. Measuring *Shine On You Crazy Diamond*, *Comfortably Numb* (the mirror ball) and *Run Like Hell* the same way is the next step.

## What the scene draws

| Rig element | Real-world counterpart | Driven by |
| --- | --- | --- |
| 5 arch ribs × 44 lamps | the band-shell arch | the cue's pattern: faint stars (black box), stars (calm), chase, pulse (rib by rib outward on the beat), fill (climax), reveal (every lamp at once, blown out, then held); in the finale the off-beats leave only the blue rim |
| Round screen + 28-lamp ring | the circular screen and its Vari*Lite ring | iris (calm), flower (spun in colour, mid), sun (big); the screen shows the Orbit or Tunnel scene |
| 24 perimeter beam lights | Telescans on the arch | static looks per cue, crossfaded over 2 beats; hard white in big sections, colour elsewhere |
| 4 pods × 6 lights on trolleys | the 1987 pods | parked (calm), sweeping in tempo (mid/big), travelling to the soloist (solo, climax) |
| 4 searchlights at front of house | Xescans | cool white, slow sweeps in the intro and a big finale |
| 2 follow spots | follow spots | the lead stem, or the soloist |
| Lasers: web, search, scan, grating | the copper-vapour and dye lasers | the black box has an amber web over a blue stage; later webs grow with the notes of the *other* stem and turn from yellow to lime halfway through; the grating rotates at the climax with red beams |
| Mirror ball | the opening mirror ball | climax only: rises over 4 bars, opens its petals, throws up to 700 reflections that turn with it |
| Pyro | flash pots | once, at the biggest jump in energy |
| Blinders, strobe | blinders, strobes | hits after the reveal; strobe on the eighth-note grid, rate-limited |
| Crowd | the audience | nodding on the beat, hands up at hits and the climax, phone lights in calm sections and under the mirror ball |

The colour default is *Classic*, set from the measurements above: cool blue in the black box, gold for the reveal, amber and gold after it (deep blue in calm sections), a new saturated colour every bar in solos, and white beams over amber with a blue rim on the arch at the climax and finale. *From key*, *Warm*, *Ice* and *Rainbow* are alternatives.

## Rendering

- The rig is modelled in metres (x to stage right, y up, z toward the audience) and projected through a camera.
- **Camera**: a shot list planned for the whole song, cut the way the film was: about one bar per shot (half a bar to two), near the bar but not on the beat, long shots in the black box and the finale, close-ups in solos, and wide on the reveal and on every hit. *Wide* is from the mixing desk, then *high* (crane), *crowd*, *side*, and *close* on the soloist. You can also pick *Wide* or *Crowd*. The timings live in `PULSE` in `web/src/app.js`.
- **Beams** are drawn into a half-resolution light buffer as soft two-layer cones that fade along their length, with pools where they hit the floor. Beams aimed into the lens are attenuated so they don't white out the frame.
- **Haze** is a drifting noise mask applied to the light buffer, so beams break up as they would in real haze.
- **Bloom** shrinks the light buffer to 160×90 and 40×23 and adds it back.
- **Lamps and glows** use cached glow sprites. The crowd is drawn in batched paths.
- About 35–45 fps in a headless browser with software rendering; a normal browser with GPU canvas runs at the display rate.

## Next steps

- **More songs from the film**: measure *Shine On You Crazy Diamond*, *Comfortably Numb* and *Run Like Hell* with the same method and check the mirror-ball and white-light rules against them.
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
