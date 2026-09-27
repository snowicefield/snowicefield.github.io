# snowicefield.github.io

Portfolio site. Plain HTML/CSS/JS, no build step.

## Structure

```
index.html                  main page: 5 fullscreen videos + About
assets/css/style.css        all styling (colors & fonts at the top, in :root)
assets/js/main.js           video loading/playback + dot navigation
assets/img/                 your photo and other shared images
projects/01_sky/
  index.html                project page (edit text here)
  media/video_1080.mp4      desktop video
  media/video_720.mp4       phone video
  media/poster.jpg          still shown while the video loads
  media/image_1..3.jpg      project page images (placeholders = video stills)
tools/make_web_media.bat    regenerate media/ from a new source video
```

Look for `<!-- EDIT -->` comments in the HTML to find what to change.

## View locally

- Quick: double-click `index.html`.
- Like the real site (and to test on your phone), in this folder run
  `python -m http.server 8000`, then open http://localhost:8000.
  On a phone on the same Wi-Fi, open `http://<your-PC-IP>:8000`.
- Or use VS Code + the "Live Server" extension (auto-reloads on save).

## Common edits

- **Change a project's text:** `projects/0X_name/index.html`.
- **Change the title / one-liner on the main page:** `index.html`.
- **Replace a video:** run `tools\make_web_media.bat projects\01_sky\new_video.mp4`.
- **Keep the subject in frame on phones:** add `style="--focus: 30% 50%"` to that
  `<video>` (x% y%; 0% = left/top edge).
- **Add a 6th project:** copy a `projects/` folder, then copy one `<a class="reel">`
  block in `index.html` and update the paths.
