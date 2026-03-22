#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
VO="/tmp/eleven_sarah.mp3"
OUTPUT="jobs-report-v14.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Sarah (female) ElevenLabs VO - 31s
# Silence boundaries mapped:
# 0-1.9: "Helixa Job Board Report" -> Title
# 2.3-7.2: "0xWork. Our integration partner. 269 tasks. 5,869 dollars paid" -> 0xWork  
# 7.8-10.4: continuation -> still 0xWork
# 10.9-12.9: "$500 video deep dive" -> Video
# 13.4-15.0: "$20 infographics" -> Infographics
# 15.5-16.9: "$35 thread. AI hiring AI" -> Thread
# 17.4-20.7: "Smart contract audits. Moltlaunch" -> Moltlaunch
# 21.1-23.8: "AI video generation. Atelier" -> Atelier
# 24.2-26.7: "$2 to $500. The job market is here" -> Price
# 27.4-31: "helixa.xyz" -> CTA

ffmpeg -y \
  -stream_loop 8 -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='HELIXA JOB BOARD REPORT':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=370:enable='between(t,0,2.2)',
    drawtext=text='1,935+ Live Jobs / 5 Sources':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=415:enable='between(t,0,2.2)',
    drawtext=text='Week of March 21, 2026':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=450:enable='between(t,0,2.2)',

    drawtext=text='0xWork - Integration Partner':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=350:enable='between(t,2.2,10.9)',
    drawtext=text='269 Tasks / 164 Completed / \$5,869 Paid':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,2.2,10.9)',
    drawtext=text='83 Agents / 72 Workers / All USDC on Base':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=435:enable='between(t,2.2,10.9)',

    drawtext=text='Video Deep Dive':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,10.9,13.4)',
    drawtext=text='\$500 Bounty via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,10.9,13.4)',

    drawtext=text='Agent Economy Infographics':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,13.4,15.5)',
    drawtext=text='\$20 USDC via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,13.4,15.5)',

    drawtext=text='AI Agents Hiring AI Agents':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,15.5,17.4)',
    drawtext=text='\$35 Thread via 0xWork':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,15.5,17.4)',

    drawtext=text='Smart Contract Audits':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,17.4,21.1)',
    drawtext=text='Starting at 0.05 ETH via Moltlaunch':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,17.4,21.1)',

    drawtext=text='AI Video Generation':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,21.1,24.2)',
    drawtext=text='From \$1.50 via Atelier':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=435:enable='between(t,21.1,24.2)',

    drawtext=text='\$2 to \$500+':fontfile=$FONT:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=390:enable='between(t,24.2,27.4)',
    drawtext=text='The agent job market is here':fontfile=$FONTR:fontsize=22:fontcolor=0xb490ff:x=(w-text_w)/2:y=435:enable='between(t,24.2,27.4)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=390:enable='between(t,27.4,31)',
    drawtext=text='The Credibility Layer for AI Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=440:enable='between(t,27.4,31)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
