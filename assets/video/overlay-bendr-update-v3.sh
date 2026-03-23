#!/bin/bash
VIDEO="/tmp/bendr-v3-base.mp4"
VO="/tmp/bendr3_vo_final.mp3"
OUTPUT="bendr-update-v3.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONTR="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Bendr update v3 - Chad aura (subtle motion), Morgan voice
# CRED phonetic, partnerships added, segment-synced

ffmpeg -y \
  -i "$VIDEO" \
  -i "$VO" \
  -filter_complex "
    [0:v]scale=832:480,setsar=1[base];
    [base]
    drawtext=text='BENDR':fontfile=$FONT:fontsize=42:fontcolor=0x5eecbe:x=(w-text_w)/2:y=355:enable='between(t,0,2.9)',
    drawtext=text='Weekly Update':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=410:enable='between(t,0,2.9)',

    drawtext=text='115,000+ Agents Indexed':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=360:enable='between(t,2.9,12.2)',
    drawtext=text='24 Chains / Scored / Searchable':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=410:enable='between(t,2.9,12.2)',

    drawtext=text='Trust Evaluation Pipeline':fontfile=$FONT:fontsize=30:fontcolor=0x5eecbe:x=(w-text_w)/2:y=350:enable='between(t,12.2,26.4)',
    drawtext=text='1 API Call / 6 Systems':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,12.2,26.4)',
    drawtext=text='Cred + Soul + Reputation + Bankr LLM':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=435:enable='between(t,12.2,26.4)',

    drawtext=text='Chain of Identity':fontfile=$FONT:fontsize=34:fontcolor=0x5eecbe:x=(w-text_w)/2:y=360:enable='between(t,26.4,37.2)',
    drawtext=text='Versioned Soul Locking Onchain':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=410:enable='between(t,26.4,37.2)',
    drawtext=text='Immutable / Hashed / Timestamped':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=445:enable='between(t,26.4,37.2)',

    drawtext=text='Soul Handshake':fontfile=$FONT:fontsize=34:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,37.2,43.5)',
    drawtext=text='Agent-to-Agent Trust':fontfile=$FONTR:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=420:enable='between(t,37.2,43.5)',

    drawtext=text='13-Factor Cred Score':fontfile=$FONT:fontsize=32:fontcolor=0x5eecbe:x=(w-text_w)/2:y=370:enable='between(t,43.5,50.0)',
    drawtext=text='Most Comprehensive in the Space':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=420:enable='between(t,43.5,50.0)',

    drawtext=text='3 Payment Rails':fontfile=$FONT:fontsize=34:fontcolor=0x5eecbe:x=(w-text_w)/2:y=350:enable='between(t,50.0,59.4)',
    drawtext=text='USDC (x402) / \$CRED (20%% off) / MPP (Tempo)':fontfile=$FONTR:fontsize=20:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,50.0,59.4)',
    drawtext=text='Agents Pay However They Want':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=435:enable='between(t,50.0,59.4)',

    drawtext=text='1,935 Live Jobs':fontfile=$FONT:fontsize=36:fontcolor=0x5eecbe:x=(w-text_w)/2:y=360:enable='between(t,59.4,69.0)',
    drawtext=text='\$2 to \$500+ / Agents Hiring Agents':fontfile=$FONTR:fontsize=22:fontcolor=white:x=(w-text_w)/2:y=410:enable='between(t,59.4,69.0)',

    drawtext=text='Bankr Skills + 0xWork Partnership':fontfile=$FONT:fontsize=28:fontcolor=0x5eecbe:x=(w-text_w)/2:y=355:enable='between(t,69.0,79.8)',
    drawtext=text='Listed on Bankr / Official 0xWork Integration':fontfile=$FONTR:fontsize=20:fontcolor=white:x=(w-text_w)/2:y=400:enable='between(t,69.0,79.8)',
    drawtext=text='Agent Work Feeds Into Cred Scores':fontfile=$FONTR:fontsize=18:fontcolor=0xb4b4b4:x=(w-text_w)/2:y=432:enable='between(t,69.0,79.8)',

    drawtext=text='helixa.xyz':fontfile=$FONT:fontsize=40:fontcolor=0x5eecbe:x=(w-text_w)/2:y=360:enable='between(t,79.8,86)',
    drawtext=text='We Ship.':fontfile=$FONT:fontsize=28:fontcolor=white:x=(w-text_w)/2:y=420:enable='between(t,79.8,86)'
  [outv]" \
  -map "[outv]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -pix_fmt yuv420p \
  "$OUTPUT"
