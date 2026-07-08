#!/bin/bash
# Convert every project's stills (jpg/jpeg/png/tif) to web JPEGs, max 1600px wide,
# into assets/stills/<slug>/NNN.jpg (original name order).
set -u
SRC="/c/Users/User/Desktop/ADAMBARNETTDOP_ASSETS/ADAMBARNETTDOP_WEBSITE"
OUT="/c/Users/User/Desktop/adambarnettdop-website/assets/stills"

conv() { # slug, source dir
  local slug="$1" dir="$2" i=0
  mkdir -p "$OUT/$slug"
  find "$dir" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.tif' -o -iname '*.tiff' \) \
    | sort | while read -r f; do
      i=$((i+1))
      local dst
      dst=$(printf "%s/%03d.jpg" "$OUT/$slug" "$i")
      [ -f "$dst" ] || ffmpeg -y -v error -i "$f" -vf "scale='min(1600,iw)':-2" -q:v 4 "$dst"
    done
  echo "STILLS OK $slug ($(ls "$OUT/$slug" | wc -l))"
}

conv tfhiaf            "$SRC/THEY FOUND HER IN A FIELD"
conv black-cab         "$SRC/BLACK CAB SHORT"
conv alice             "$SRC/ALICE - SHORT"
conv autofiction       "$SRC/AUTOFICTION - STILLS"
conv if-they-come      "$SRC/IF THEY COME - STILLS"
conv colour-of-my-room "$SRC/COLOUR OF MY ROOM"
conv colour-of-my-room-bts "$SRC/COLOUR OF MY ROOM/COMR_BTS"
conv within            "$SRC/WITHIN"
conv bmth-strangers    "$SRC/BRING ME THE HORIZON - STRANGERS"
conv oh-wonder-22-break "$SRC/OH WONDER - 22 BREAK"
conv eaves-wilder-the-great-plain "$SRC/EAVES WILDER - THE GREAT PLAIN"
conv lucy-blue-tax-driver "$SRC/LUCY BLUE - TAX DRIVER"
conv luis-rojo-bruisedhug "$SRC/LUIS ROJO - BRUISEDHUG"
conv dirty-danger-run  "$SRC/DIRTY DANGER"

echo "ALL STILLS DONE"
