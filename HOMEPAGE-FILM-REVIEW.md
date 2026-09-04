# Cinematic homepage — September 4, 2026

## Direction

Image-led coastal homepage, dark navy, sea-glass actions, restrained type and motion. Design variance 7 / motion 6 / density 4. The front page is an invitation into the city; detailed resident tools keep their quieter existing layouts. No generated imagery, decorative statistics or invented city updates.

The homepage now opens with “Your Miami Beach,” followed by resident search, an area-based project map, official city news and David’s video series. The episode thumbnail is uncropped and its copy is beside/below it, never over the faces.

## Real footage

The owner supplied six stock-footage files. Originals remain untouched outside Git. The homepage uses four of them: South Pointe inlet (17-26-34), South Beach coastline (16-02-23), Ocean Drive aerial (14-33-51), sunset boat (20-56-32). The 8th Street lifeguard clip supplies the news-section still. The remaining downtown aerial is reserved for future edits.

The revised film uses three different owner-authorized YouTube videos: Ride Along (`2fU3AA-g20k`, 00:30–00:34), Civics 101 Part 1 (`80vmW26Xr7w`, 01:44.5–01:48.5), and the Soffer episode of Suarez Sound Off (`BBupCl9Bc2w`, 02:56.5–02:59.9). David appears in every people shot. The podcast excerpt stays on the host camera, never cutting to the guest. The source’s introductory white transition, civics title card and cutaways to documents are excluded. Published caption areas are cropped out; both desktop and mobile use inspected, shot-specific framing. The public sources page credits all three videos and makes clear this is a montage, not current conditions or one continuous event. Stock licensing documentation remains with the owner; no independent license verification is claimed.

Render: seven shots, approximately 24.4 seconds, 24 fps, half-second dissolves, no audio track. Desktop 1280×720; mobile 540×720. JPEG poster ~257 KB, lifeguard still ~94 KB. Reproduce with `scripts/render-home-film.mjs` and source directories; FFmpeg path is configurable. The podcast input is a locally downloaded 02:00–03:00 excerpt of the original episode. Build-time content hashes on both video URLs prevent browsers retaining an older edit.

## Behavior

- Local autoplay is muted; a visible play/pause button reflects actual playback.
- Reduced motion and data-saving preferences prevent automatic video loading. Visitors may explicitly play it.
- Hidden tabs and offscreen hero pause playback; an explicit pause stays paused on return.
- Autoplay rejection leaves the poster and a working play button. File errors restore the poster. Without JavaScript, no inert play button is shown.
- The map loads near the viewport, with separate readable project links and a fallback directory if data or map resources fail. Area views use approximate latitude bands, not official neighborhood boundaries.
- Wheel zoom is disabled; touch dragging is disabled on coarse pointers so the map does not trap page scrolling. Zoom controls and area selectors remain available. Detailed exploration lives on the project page.
- Project list collapses duplicate GIS features belonging to one project. Pins retain feature locations. Source phase labels are not new claims of active construction.
- Source-fed news and videos, existing loading shells, shared navigation and civic readers are preserved.

## Verification

- Built all 12 routes; 318 local links/assets validated, parser and public-data checks pass.
- Motion tests pass. New film tests cover mobile sources, manual pause/resume, offscreen/hidden tabs, reduced motion, data saving and autoplay denial.
- Browser checked at 1440×1000 and 390×844: no horizontal overflow, film plays, pause works, menu/Escape works, map tiles load and area tabs change records.
- Rendered desktop/mobile contact sheets inspected; removed a source flash and corrected mobile face framing.
- Original source videos and temporary editing tools are not committed. User-owned `design-qa 2.md` is untouched.
