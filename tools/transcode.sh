#!/bin/bash
# Transcode Adam Barnett DOP source masters into web assets:
#   loops/<slug>.mp4   - muted 720p ~16s hover loop
#   films/<slug>.mp4   - 1080p full piece w/ audio (where publishable)
#   posters/<slug>.jpg - poster frame
set -u
SRC="/c/Users/User/Desktop/ADAMBARNETTDOP_ASSETS/ADAMBARNETTDOP_WEBSITE"
OUT="/c/Users/User/Desktop/adambarnettdop-website/assets"
mkdir -p "$OUT/loops" "$OUT/films" "$OUT/posters"

loop() { # slug, src, loop_start_seconds
  local slug="$1" src="$2" start="$3"
  [ -f "$OUT/loops/$slug.mp4" ] && return
  ffmpeg -y -v error -ss "$start" -i "$src" -t 16 \
    -vf "scale=-2:720" -an -c:v libx264 -crf 26 -preset medium \
    -pix_fmt yuv420p -movflags +faststart "$OUT/loops/$slug.mp4" \
    && echo "LOOP OK $slug" || echo "LOOP FAIL $slug"
}

film() { # slug, src
  local slug="$1" src="$2"
  [ -f "$OUT/films/$slug.mp4" ] && return
  ffmpeg -y -v error -i "$src" \
    -vf "scale=-2:min(1080\,ih)" -c:v libx264 -crf 23 -preset fast \
    -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$OUT/films/$slug.mp4" \
    && echo "FILM OK $slug" || echo "FILM FAIL $slug"
}

poster() { # slug  (frame from loop at 1s)
  local slug="$1"
  [ -f "$OUT/posters/$slug.jpg" ] && return
  ffmpeg -y -v error -ss 1 -i "$OUT/loops/$slug.mp4" -frames:v 1 -q:v 3 \
    "$OUT/posters/$slug.jpg" && echo "POSTER OK $slug"
}

# --- loops (start point picked to skip titles/black) ---
loop tfhiaf            "$SRC/THEY FOUND HER IN A FIELD/TFHIAF Teaser.mp4" 4
loop black-cab         "$SRC/BLACK CAB SHORT/BLACKCAB_Trailer_CLEAN.MP4" 6
loop alice             "$SRC/ALICE - SHORT/Alice_2160p25_ProRes422HQ_Rec709_5x1_20240726.MOV" 3
loop if-they-come      "$SRC/IF THEY COME - STILLS/if they come.mp4" 45
loop colour-of-my-room "$SRC/COLOUR OF MY ROOM/colour of my room.mp4" 240
loop just-act-normal   "$SRC/JUST ACT NORMAL - GRADE AND CAMERA TESTS/wga_grade_test_wip_20240419.mov" 120
loop within            "$SRC/WITHIN/wit__h__in_-_for_better_mental_health (2160p).mp4" 45
loop oh-wonder-22-break "$SRC/OH WONDER - 22 BREAK/22_break_-_trailer (1080p).mp4" 30
loop eaves-wilder-the-great-plain "$SRC/EAVES WILDER - THE GREAT PLAIN/GD_EavesWIlder_TheGreatPlains_Final_4k.mp4" 70
loop lucy-blue-tax-driver "$SRC/LUCY BLUE - TAX DRIVER/210802_LUCY_BLUE_DIRECTORS_CUT.mp4" 55
loop luis-rojo-bruisedhug "$SRC/LUIS ROJO - BRUISEDHUG/"bruisehug*v2.mp4 24
loop dirty-danger-run  "$SRC/DIRTY DANGER/dirty_danger_-_run (1080p).mp4" 40

# --- full films (publishable pieces only) ---
film tfhiaf            "$SRC/THEY FOUND HER IN A FIELD/TFHIAF Teaser.mp4"
film black-cab         "$SRC/BLACK CAB SHORT/BLACKCAB_Trailer_CLEAN.MP4"
film alice             "$SRC/ALICE - SHORT/Alice_2160p25_ProRes422HQ_Rec709_5x1_20240726.MOV"
film if-they-come      "$SRC/IF THEY COME - STILLS/if they come.mp4"
film colour-of-my-room "$SRC/COLOUR OF MY ROOM/colour of my room.mp4"
film within            "$SRC/WITHIN/wit__h__in_-_for_better_mental_health (2160p).mp4"
film oh-wonder-22-break "$SRC/OH WONDER - 22 BREAK/22_break_-_trailer (1080p).mp4"
film eaves-wilder-the-great-plain "$SRC/EAVES WILDER - THE GREAT PLAIN/GD_EavesWIlder_TheGreatPlains_Final_4k.mp4"
film lucy-blue-tax-driver "$SRC/LUCY BLUE - TAX DRIVER/210802_LUCY_BLUE_DIRECTORS_CUT.mp4"
film luis-rojo-bruisedhug "$SRC/LUIS ROJO - BRUISEDHUG/"bruisehug*v2.mp4
film dirty-danger-run  "$SRC/DIRTY DANGER/dirty_danger_-_run (1080p).mp4"

for s in tfhiaf black-cab alice if-they-come colour-of-my-room just-act-normal within \
         oh-wonder-22-break eaves-wilder-the-great-plain lucy-blue-tax-driver \
         luis-rojo-bruisedhug dirty-danger-run; do poster "$s"; done

echo "ALL VIDEO TRANSCODES DONE"
