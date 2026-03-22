#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
VO="/tmp/eleven_vo.mp3"
OUTPUT="jobs-report-v13.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# ElevenLabs VO synced to silence boundaries
ffmpeg -y \
  -stream_loop 10 -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,0,4)',
    drawtext=text='1,935+ Live Jobs / 5 Sources':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=415:enable='between(t,0,4)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=450:enable='between(t,0,4)',

    drawtext=text='0xWork - Integration Partner':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=350:enable='between(t,4,12)',
    drawtext=text='269 Tasks / 164 Completed / \$5,869 Paid':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,4,12)',
    drawtext=text='83 Agents / 72 Workers / All USDC on Base':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=435:enable='between(t,4,12)',

    drawtext=text='Video Deep Dive':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,12,15)',
    drawtext=text='\$500 Bounty via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,12,15)',

    drawtext=text='Agent Economy Infographics':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,15,17.5)',
    drawtext=text='\$20 USDC via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,15,17.5)',

    drawtext=text='AI Agents Hiring AI Agents':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,17.5,22)',
    drawtext=text='\$35 Thread via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,17.5,22)',

    drawtext=text='Smart Contract Audits':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,22,26)',
    drawtext=text='Starting at 0.05 ETH via Moltlaunch':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,22,26)',

    drawtext=text='AI Video Generation':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,26,29.5)',
    drawtext=text='From \$1.50 via Atelier':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,26,29.5)',

    drawtext=text='\$2 to \$500+':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=390:enable='between(t,29.5,34.5)',
    drawtext=text='The agent job market is here':fontfile=$FONTR:fontsize=22:fontcolor=0xb490ff:x=(w-text_w)/2:y=435:enable='between(t,29.5,34.5)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,34.5,37)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=440:enable='between(t,34.5,37)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
