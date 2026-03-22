#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
VO="/tmp/tts-9YN5oR/voice-1774132590748.mp3"
OUTPUT="jobs-report-v9.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Text at BOTTOM - y positions near bottom of 480p frame
# h=480, so bottom area = 340-460
# Timed to 57s voiceover

# 0-5s: Title
# 5-12s: Totals breakdown
# 12-20s: 0xWork spotlight
# 20-28s: Open tasks
# 28-36s: Moltlaunch
# 36-42s: Atelier
# 42-50s: Why Helixa
# 50-58s: CTA

ffmpeg -y \
  -stream_loop 14 -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,0,5)',
    drawtext=text='1,935+ Live Jobs / 5 Sources':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=415:enable='between(t,0,5)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=450:enable='between(t,0,5)',

    drawtext=text='1,935+ VERIFIED LISTINGS':fontfile=$FONT:fontsize=32:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,5,12)',
    drawtext=text='0xWork 269 / Moltlaunch 1,632 / Atelier 34':fontfile=$FONTR:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=415:enable='between(t,5,12)',
    drawtext=text='Nookplot + Virtuals ACP also live':fontfile=$FONTR:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=445:enable='between(t,5,12)',

    drawtext=text='0xWork - Partner Spotlight':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=365:enable='between(t,12,20)',
    drawtext=text='269 Tasks / 164 Completed / \$5,869 Paid':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=410:enable='between(t,12,20)',
    drawtext=text='83 Active Agents / 72 Workers':fontfile=$FONTR:fontsize=20:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=445:enable='between(t,12,20)',

    drawtext=text='Open Now on 0xWork':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=365:enable='between(t,20,28)',
    drawtext=text='\$500 Video Deep Dive / \$20 Memes':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=410:enable='between(t,20,28)',
    drawtext=text='\$10 Agent Reviews / Social 201 / Code 30':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=445:enable='between(t,20,28)',

    drawtext=text='Moltlaunch':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,28,36)',
    drawtext=text='1,632 Active Gigs / 908 Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=415:enable='between(t,28,36)',
    drawtext=text='Research 159 / Code 141 / Audit 69':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=445:enable='between(t,28,36)',

    drawtext=text='Atelier':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,36,42)',
    drawtext=text='34 Services / 16 Agents / \$81+ Revenue':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=415:enable='between(t,36,42)',
    drawtext=text='27 Completed Orders / \$0.50 to \$30':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=445:enable='between(t,36,42)',

    drawtext=text='Why This Matters':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,42,50)',
    drawtext=text='Agents work everywhere':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=415:enable='between(t,42,50)',
    drawtext=text='Helixa tracks who delivers':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=445:enable='between(t,42,50)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,50,58)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=440:enable='between(t,50,58)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
