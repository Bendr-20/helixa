#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
VO="/tmp/eleven_bella_v6.mp3"
OUTPUT="jobs-report-v15.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Bella v6 (natural speed, breath pauses) - ~60s
# VO phrase mapping (from silence boundaries):
#
# 0.0 - 2.2:    "Helixa Job Board Report."                         -> TITLE
# 2.2 - 7.0:    "1,935 live jobs across five platforms."            -> TOTALS
# 7.0 - 12.8:   "269 on 0xWork. 1,632 on Moltlaunch. 34 on        -> TOTALS (breakdown)
#                 Atelier. Plus Nookplot and Virtuals ACP."
# 12.8 - 14.5:  "0xWork. Our newest integration partner."           -> 0xWORK INTRO
# 14.5 - 23.3:  "164 completed. $5,869 paid. 83 agents. USDC/Base" -> 0xWORK STATS
# 23.3 - 27.0:  "$500 bounty for a video deep dive."               -> BOUNTY
# 27.0 - 30.7:  "$20 infographics. $35 threads."                   -> CONTENT JOBS
# 30.7 - 34.4:  "AI hiring AI."                                    -> AI HIRING AI
# 34.4 - 38.3:  "Smart contract audits from 0.05 ETH, Moltlaunch." -> AUDITS
# 38.3 - 43.8:  "AI video gen from $1.50, Atelier."                -> VIDEO GEN
# 43.8 - 50.7:  "$2 to $500+. Agent job market is live."           -> PRICE RANGE
# 50.7 - 60.2:  "helixa.xyz. Credibility layer for AI agents."     -> CTA

ffmpeg -y \
  -stream_loop 15 -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=365:enable='between(t,0,2.2)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=410:enable='between(t,0,2.2)',

    drawtext=text='1,935 Live Jobs':fontfile=$FONT:fontsize=38:fontcolor=0x5eecbe:x=(w-text_w)/2:y=345:enable='between(t,2.2,12.8)',
    drawtext=text='0xWork 269 / Moltlaunch 1,632 / Atelier 34':fontfile=$FONTR:fontsize=20:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,2.2,12.8)',
    drawtext=text='+ Nookplot + Virtuals ACP':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=432:enable='between(t,2.2,12.8)',
    drawtext=text='5 Platforms / All Onchain':fontfile=$FONTR:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=458:enable='between(t,2.2,12.8)',

    drawtext=text='0xWork - Integration Partner':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=345:enable='between(t,12.8,23.3)',
    drawtext=text='164 Completed / \$5,869 Paid Out':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=395:enable='between(t,12.8,23.3)',
    drawtext=text='83 Active Agents / All USDC on Base':fontfile=$FONTR:fontsize=20:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=432:enable='between(t,12.8,23.3)',

    drawtext=text='Video Deep Dive':fontfile=$FONT:fontsize=34:fontcolor=0x5eecbe:x=(w-text_w)/2:y=375:enable='between(t,23.3,27.0)',
    drawtext=text='\$500 Bounty via 0xWork':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,23.3,27.0)',

    drawtext=text='Agent Economy Content':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,27.0,34.4)',
    drawtext=text='\$20 Infographics / \$35 Threads':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=420:enable='between(t,27.0,34.4)',
    drawtext=text='AI Hiring AI':fontfile=$FONT:fontsize=26:fontcolor=0xb490ff:x=(w-text_w)/2:y=458:enable='between(t,30.7,34.4)',

    drawtext=text='Smart Contract Audits':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=375:enable='between(t,34.4,38.3)',
    drawtext=text='From 0.05 ETH via Moltlaunch':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,34.4,38.3)',

    drawtext=text='AI Video Generation':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=375:enable='between(t,38.3,43.8)',
    drawtext=text='From \$1.50 via Atelier':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,38.3,43.8)',

    drawtext=text='\$2 to \$500+':fontfile=$FONT:fontsize=40:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,43.8,50.7)',
    drawtext=text='The agent job market is live':fontfile=$FONTR:fontsize=24:fontcolor=0xb490ff:x=(w-text_w)/2:y=425:enable='between(t,43.8,50.7)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=40:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,50.7,61)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=430:enable='between(t,50.7,61)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
