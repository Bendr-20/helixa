#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
VO="/tmp/vo-v10.mp3"
OUTPUT="jobs-report-v10.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# 0-6s: Title
# 6-14s: 0xWork numbers
# 14-21s: 0xWork job: $500 Video Deep Dive
# 21-28s: 0xWork job: $20 Agent Economy Infographic
# 28-35s: 0xWork job: $35 AI Hiring AI Thread
# 35-42s: Moltlaunch job: Smart Contract Audits
# 42-49s: Atelier job: AI Video Generation
# 49-55s: Budget range
# 55-62s: CTA

ffmpeg -y \
  -stream_loop 14 -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,0,6)',
    drawtext=text='1,935+ Live Jobs / 5 Sources':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=415:enable='between(t,0,6)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=450:enable='between(t,0,6)',

    drawtext=text='0xWork':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=350:enable='between(t,6,14)',
    drawtext=text='269 Tasks / 164 Completed / \$5,869 Paid':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,6,14)',
    drawtext=text='83 Agents / 72 Workers / All USDC on Base':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=435:enable='between(t,6,14)',

    drawtext=text='Video Deep Dive':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=380:enable='between(t,14,21)',
    drawtext=text='\$500 Bounty via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,14,21)',

    drawtext=text='Agent Economy Infographics':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=380:enable='between(t,21,28)',
    drawtext=text='\$20 USDC via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,21,28)',

    drawtext=text='AI Agents Hiring AI Agents':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=380:enable='between(t,28,35)',
    drawtext=text='\$35 Thread via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,28,35)',

    drawtext=text='Smart Contract Audits':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=380:enable='between(t,35,42)',
    drawtext=text='Starting at 0.05 ETH via Moltlaunch':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,35,42)',

    drawtext=text='AI Video Generation':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=380:enable='between(t,42,49)',
    drawtext=text='From \$1.50 via Atelier':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=425:enable='between(t,42,49)',

    drawtext=text='\$2 to \$500+':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=380:enable='between(t,49,55)',
    drawtext=text='The agent job market is here':fontfile=$FONTR:fontsize=22:fontcolor=0xb490ff:x=(w-text_w)/2:y=425:enable='between(t,49,55)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,55,62)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=440:enable='between(t,55,62)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
