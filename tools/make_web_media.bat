@echo off
REM ==============================================================
REM  Make web-ready files from one source video.
REM
REM  Usage (run from the site folder):
REM    tools\make_web_media.bat projects\01_sky\sky_demo_10s.mp4
REM
REM  Creates, in projects\01_sky\media\ :
REM    video_1080.mp4  desktop version (no audio, starts streaming fast)
REM    video_720.mp4   phone version (much smaller)
REM    poster.jpg      frame shown while the video loads
REM
REM  Needs ffmpeg. Install once with:  winget install Gyan.FFmpeg
REM ==============================================================
setlocal
set "IN=%~1"
if "%IN%"=="" (
  echo Usage: tools\make_web_media.bat path\to\video.mp4
  exit /b 1
)
set "OUT=%~dp1media"
if not exist "%OUT%" mkdir "%OUT%"

echo [1/3] 1080p ...
ffmpeg -v error -y -i "%IN%" -map 0:v:0 -vf "scale=-2:'min(1080,ih)'" -c:v libx264 -pix_fmt yuv420p -crf 22 -preset slow -maxrate 6M -bufsize 12M -movflags +faststart "%OUT%\video_1080.mp4" || exit /b 1

echo [2/3] 720p ...
ffmpeg -v error -y -i "%IN%" -map 0:v:0 -vf "scale=-2:720" -c:v libx264 -pix_fmt yuv420p -crf 26 -preset slow -movflags +faststart "%OUT%\video_720.mp4" || exit /b 1

echo [3/3] poster ...
ffmpeg -v error -y -ss 0.5 -i "%IN%" -frames:v 1 -vf "scale=1280:-2" -q:v 4 "%OUT%\poster.jpg" || exit /b 1

echo Done: %OUT%
endlocal
