#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
VO="/tmp/tts-HlUvTg/voice-1774134165421.mp3"
OUTPUT="jobs-report-v12.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Tightly synced to VO silence gaps
# Section boundaries from silencedetect:
# 0-2.7: "Helixa Job Board Report"
# 4.8-12.0: "0xWork. Our integration partner. 269 tasks. $5,869 paid"
# 13.1-15.0: "$500 video deep dive"
# 16.1-17.7: "$20 infographics"  
# 18.7-22.3: "$35 thread. AI hiring AI"
# 23.4-26.4: "Smart contract audits. Moltlaunch"
# 27.4-28.9: "AI video generation. Atelier"
# 29.9-33.0: "$2 to $500. The job market is here"
# 34.0-38.7: "helixa.xyz"

ffmpeg -y \
  -stream_loop 10 -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,0,4.5)',
    drawtext=text='1,935+ Live Jobs / 5 Sources':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=415:enable='between(t,0,4.5)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=450:enable='between(t,0,4.5)',

    drawtext=text='0xWork - Integration Partner':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=350:enable='between(t,4.5,13)',
    drawtext=text='269 Tasks / 164 Completed / \$5,869 Paid':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,4.5,13)',
    drawtext=text='83 Agents / 72 Workers / All USDC on Base':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=435:enable='between(t,4.5,13)',

    drawtext=text='Video Deep Dive':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,13,16)',
    drawtext=text='\$500 Bounty via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,13,16)',

    drawtext=text='Agent Economy Infographics':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,16,18.5)',
    drawtext=text='\$20 USDC via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,16,18.5)',

    drawtext=text='AI Agents Hiring AI Agents':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,18.5,23)',
    drawtext=text='\$35 Thread via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,18.5,23)',

    drawtext=text='Smart Contract Audits':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,23,27)',
    drawtext=text='Starting at 0.05 ETH via Moltlaunch':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,23,27)',

    drawtext=text='AI Video Generation':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,27,30)',
    drawtext=text='From \$1.50 via Atelier':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,27,30)',

    drawtext=text='\$2 to \$500+':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=390:enable='between(t,30,34)',
    drawtext=text='The agent job market is here':fontfile=$FONTR:fontsize=22:fontcolor=0xb490ff:x=(w-text_w)/2:y=435:enable='between(t,30,34)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,34,39)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=440:enable='between(t,34,39)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
