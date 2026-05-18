#!/opt/homebrew/bin/fish
if test (count $argv) -lt 1
  echo "Usage: scripts/fetch_sermon.fish <yt_url>" 1>&2
  exit 1
end

set yt_url "$argv[1]"

yt-dlp \
  -f "bestaudio*" \
  -x \
  --audio-format opus \
  --audio-quality 40K \
  --write-thumbnail \
  --write-info-json \
  --convert-thumbnails webp \
  --ppa "ExtractAudio:-af highpass=f=70,lowpass=f=12000,acompressor=threshold=-18dB:ratio=2:attack=20:release=250,loudnorm" \
  --ppa "ExtractAudio:-c:a libopus -b:a 40k -vbr on -compression_level 10 -application voip" \
  -o "scripts/%(id)s/%(id)s.%(ext)s" \
  "$yt_url"
