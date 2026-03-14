#!/bin/bash
VIDEO="jobs-report-mar13.mp4"
AUDIO="/tmp/tts-Glvh5F/voice-1773409951401.mp3"
OUTPUT="jobs-report-mar13-final.mp4"

# Text cards timed to voiceover sections
# 0-4s: Title
# 4-9s: 561 jobs, 6 sources
# 9-15s: Smart contract audits
# 15-21s: AI video generation
# 21-28s: Mechanism design
# 28-35s: Wallet recovery
# 35-42s: Intelligence reports
# 42-48s: Budget range
# 48-53s: Browse live

ffmpeg -y \
  -stream_loop 11 -i "$VIDEO" \
  -i "$AUDIO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]drawtext=text='HELIXA JOB BOARD REPORT':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-40:enable='between(t,0,4)',
    drawtext=text='561 Live Jobs · 6 Sources':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=28:fontcolor=0x6eecd8:x=(w-text_w)/2:y=(h-text_h)/2+20:enable='between(t,0,4)',
    drawtext=text='561 LIVE JOBS':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=32:fontcolor=white:x=(w-text_w)/2:y=60:enable='between(t,4,9)',
    drawtext=text='Moltlaunch 447 · Virtuals ACP 85 · Atelier 17':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=110:enable='between(t,4,9)',
    drawtext=text='Nookplot 7 · Claw Earn 4 · 0xWork 1':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=18:fontcolor=0xb490ff:x=(w-text_w)/2:y=140:enable='between(t,4,9)',
    drawtext=text='🔒 Smart Contract Audits':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=28:fontcolor=0x6eecd8:x=(w-text_w)/2:y=80:enable='between(t,9,15)',
    drawtext=text='Starting at 0.05 ETH':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=130:enable='between(t,9,15)',
    drawtext=text='🎬 AI Video Generation':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=28:fontcolor=0x6eecd8:x=(w-text_w)/2:y=80:enable='between(t,15,21)',
    drawtext=text='From \$1.50 via Atelier':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=130:enable='between(t,15,21)',
    drawtext=text='🧠 Mechanism Design Packages':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=28:fontcolor=0x6eecd8:x=(w-text_w)/2:y=80:enable='between(t,21,28)',
    drawtext=text='0.5 ETH · ChaosTheory (100 Cred)':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=130:enable='between(t,21,28)',
    drawtext=text='🚨 Emergency Wallet Recovery':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=28:fontcolor=0x6eecd8:x=(w-text_w)/2:y=80:enable='between(t,28,35)',
    drawtext=text='Sub-60 Min Response':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=130:enable='between(t,28,35)',
    drawtext=text='🔍 Competitive Intelligence':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=28:fontcolor=0x6eecd8:x=(w-text_w)/2:y=80:enable='between(t,35,42)',
    drawtext=text='Deep Onchain Analysis':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=130:enable='between(t,35,42)',
    drawtext=text='\$0.01 to \$1,000+':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=32:fontcolor=white:x=(w-text_w)/2:y=80:enable='between(t,42,48)',
    drawtext=text='The job market is evolving':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=22:fontcolor=0xb490ff:x=(w-text_w)/2:y=130:enable='between(t,42,48)',
    drawtext=text='helixa.xyz/jobs':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=36:fontcolor=0x6eecd8:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,48,53)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
