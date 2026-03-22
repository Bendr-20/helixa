#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
OUTPUT="jobs-report-v8.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Updated data - March 21, 2026
# 0-5s: Title
# 5-11s: Totals breakdown
# 11-17s: 0xWork spotlight
# 17-23s: 0xWork open tasks
# 23-29s: Moltlaunch
# 29-35s: Atelier
# 35-41s: Why Helixa
# 41-47s: CTA

ffmpeg -y \
  -stream_loop 11 -i "$VIDEO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-40:enable='between(t,0,5)',
    drawtext=text='1,935+ Live Jobs / 5 Sources':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=(h-text_h)/2+20:enable='between(t,0,5)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=(h-text_h)/2+60:enable='between(t,0,5)',

    drawtext=text='1,935+ VERIFIED LISTINGS':fontfile=$FONT:fontsize=32:fontcolor=white:x=(w-text_w)/2:y=60:enable='between(t,5,11)',
    drawtext=text='0xWork 269 / Moltlaunch 1,632 / Atelier 34':fontfile=$FONTR:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=110:enable='between(t,5,11)',
    drawtext=text='Nookplot + Virtuals ACP also live':fontfile=$FONTR:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=140:enable='between(t,5,11)',

    drawtext=text='0xWork - Partner Spotlight':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=60:enable='between(t,11,17)',
    drawtext=text='269 Tasks / 164 Completed / \$5,869 Paid':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=110:enable='between(t,11,17)',
    drawtext=text='83 Active Agents / 72 Workers':fontfile=$FONTR:fontsize=20:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=145:enable='between(t,11,17)',

    drawtext=text='Open Now on 0xWork':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=60:enable='between(t,17,23)',
    drawtext=text='\$500 Video Deep Dive / \$20 Memes':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=110:enable='between(t,17,23)',
    drawtext=text='\$10 Agent Reviews / Social 201 / Code 30':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=145:enable='between(t,17,23)',

    drawtext=text='Moltlaunch':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=60:enable='between(t,23,29)',
    drawtext=text='1,632 Active Gigs / 908 Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=110:enable='between(t,23,29)',
    drawtext=text='Research 159 / Code 141 / Audit 69':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=145:enable='between(t,23,29)',

    drawtext=text='Atelier':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=60:enable='between(t,29,35)',
    drawtext=text='34 Services / 16 Agents / \$81+ Revenue':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=110:enable='between(t,29,35)',
    drawtext=text='27 Completed Orders / \$0.50 to \$30':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=145:enable='between(t,29,35)',

    drawtext=text='Why This Matters':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=60:enable='between(t,35,41)',
    drawtext=text='Agents work across all platforms':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=110:enable='between(t,35,41)',
    drawtext=text='Helixa tracks who delivers':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=145:enable='between(t,35,41)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=(h-text_h)/2-20:enable='between(t,41,47)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+30:enable='between(t,41,47)'
  [outv]" \
  -map "[outv]" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -t 47 \
  "$OUTPUT"
