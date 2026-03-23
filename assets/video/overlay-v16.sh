#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
VO="/tmp/vo_final.mp3"
OUTPUT="jobs-report-v16.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Bella v16 - segment-concatenated VO with known timestamps
# Each VO clip generated separately, concatenated with 0.5s gaps
# Timestamps are EXACT from cumulative durations, not estimated
#
# 00.0 - 02.4  "Helixa Job Board Report"              -> TITLE
# 02.4 - 07.8  "1,935 live jobs across 5 platforms"    -> TOTALS HEADLINE
# 07.8 - 19.3  "269 on 0xWork, 1632 on Moltlaunch..." -> TOTALS BREAKDOWN
# 19.3 - 33.5  "0xWork...164 completed...$5,869 paid"  -> 0xWORK STATS
# 33.5 - 36.9  "$500 bounty for video deep dive"       -> BOUNTY
# 36.9 - 43.2  "$20 infographics, $35 threads, AI..."  -> CONTENT JOBS
# 43.2 - 48.3  "Smart contract audits...Moltlaunch"    -> AUDITS
# 48.3 - 53.6  "AI video gen...$1.50...Atelier"        -> VIDEO GEN
# 53.6 - 58.6  "$2 to $500+. Job market is live"       -> PRICE RANGE
# 58.6 - 63.3  "helixa.xyz. Credibility layer..."      -> CTA

ffmpeg -y \
  -stream_loop 15 -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=365:enable='between(t,0,2.4)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=412:enable='between(t,0,2.4)',

    drawtext=text='1,935 Live Jobs':fontfile=$FONT:fontsize=38:fontcolor=0x5eecbe:x=(w-text_w)/2:y=360:enable='between(t,2.4,7.8)',
    drawtext=text='5 Platforms / All Onchain':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=410:enable='between(t,2.4,7.8)',

    drawtext=text='1,935 Live Jobs':fontfile=$FONT:fontsize=34:fontcolor=0x5eecbe:x=(w-text_w)/2:y=340:enable='between(t,7.8,19.3)',
    drawtext=text='0xWork 269 / Moltlaunch 1,632 / Atelier 34':fontfile=$FONTR:fontsize=20:fontcolor=white:x=(w-text_w)/2:y=390:enable='between(t,7.8,19.3)',
    drawtext=text='+ Nookplot + Virtuals ACP':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=422:enable='between(t,7.8,19.3)',
    drawtext=text='5 Platforms / All Onchain':fontfile=$FONTR:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=450:enable='between(t,7.8,19.3)',

    drawtext=text='0xWork - Integration Partner':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=345:enable='between(t,19.3,33.5)',
    drawtext=text='164 Completed / \$5,869 Paid Out':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=395:enable='between(t,19.3,33.5)',
    drawtext=text='83 Active Agents / All USDC on Base':fontfile=$FONTR:fontsize=20:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=432:enable='between(t,19.3,33.5)',

    drawtext=text='Video Deep Dive':fontfile=$FONT:fontsize=34:fontcolor=0x5eecbe:x=(w-text_w)/2:y=375:enable='between(t,33.5,36.9)',
    drawtext=text='\$500 Bounty via 0xWork':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,33.5,36.9)',

    drawtext=text='Agent Economy Content':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=365:enable='between(t,36.9,43.2)',
    drawtext=text='\$20 Infographics / \$35 Threads':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=415:enable='between(t,36.9,43.2)',
    drawtext=text='AI Hiring AI':fontfile=$FONT:fontsize=24:fontcolor=0xb490ff:x=(w-text_w)/2:y=455:enable='between(t,40.5,43.2)',

    drawtext=text='Smart Contract Audits':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=375:enable='between(t,43.2,48.3)',
    drawtext=text='From 0.05 ETH via Moltlaunch':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,43.2,48.3)',

    drawtext=text='AI Video Generation':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=375:enable='between(t,48.3,53.6)',
    drawtext=text='From \$1.50 via Atelier':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,48.3,53.6)',

    drawtext=text='\$2 to \$500+':fontfile=$FONT:fontsize=40:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,53.6,58.6)',
    drawtext=text='The agent job market is live':fontfile=$FONTR:fontsize=24:fontcolor=0xb490ff:x=(w-text_w)/2:y=425:enable='between(t,53.6,58.6)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=40:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,58.6,64)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=430:enable='between(t,58.6,64)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
