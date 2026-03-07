#!/usr/bin/env python3
"""
Helixa X/Twitter posting script for @BendrAI_eth
Usage: python3 x-post.py "tweet text"
       python3 x-post.py --reply <tweet_id> "reply text"
       python3 x-post.py --search "query"
       python3 x-post.py --mentions
"""

import sys
import json
import os
from requests_oauthlib import OAuth1Session

# Load keys
def get_session():
    return OAuth1Session(
        'SdSIk9AeNFEU1phQ2HPuk3xxe',
        client_secret='hVx2GEgtw33SoOyh0ijKidTUibXlD2LaP2kLAI0RVF2LTDHVC5',
        resource_owner_key='2018345610835816448-2JpZD1gjgce121tr9IGClM7kbEYovZ',
        resource_owner_secret='NLxI9HmMIrOLomOqoSYaaYLosVh0Qynk3VJAytNErxr5T'
    )

def tweet(text, reply_to=None):
    x = get_session()
    payload = {"text": text}
    if reply_to:
        payload["reply"] = {"in_reply_to_tweet_id": reply_to}
    r = x.post('https://api.x.com/2/tweets', json=payload)
    d = r.json()
    if r.status_code == 201:
        tid = d['data']['id']
        print(f"✓ Posted: https://x.com/BendrAI_eth/status/{tid}")
        return tid
    else:
        print(f"✗ Error {r.status_code}: {json.dumps(d)}")
        return None

def search(query, max_results=10):
    x = get_session()
    r = x.get(f'https://api.x.com/2/tweets/search/recent?query={query}&max_results={max_results}&tweet.fields=author_id,created_at&expansions=author_id&user.fields=username,name')
    d = r.json()
    if 'data' in d:
        users = {u['id']: u for u in d.get('includes', {}).get('users', [])}
        for t in d['data']:
            user = users.get(t['author_id'], {})
            print(f"@{user.get('username','?')} ({t['created_at'][:10]}): {t['text'][:200]}")
            print(f"  → https://x.com/{user.get('username','i')}/status/{t['id']}")
            print()
    else:
        print(f"No results or error: {json.dumps(d)}")

def mentions(max_results=10):
    x = get_session()
    r = x.get(f'https://api.x.com/2/users/2018345610835816448/mentions?max_results={max_results}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username')
    d = r.json()
    if 'data' in d:
        users = {u['id']: u for u in d.get('includes', {}).get('users', [])}
        for t in d['data']:
            user = users.get(t['author_id'], {})
            print(f"@{user.get('username','?')}: {t['text'][:200]}")
            print(f"  → https://x.com/{user.get('username','i')}/status/{t['id']}")
            print()
    else:
        print(f"No mentions or error: {json.dumps(d)}")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Helixa X/Twitter posting script')
    parser.add_argument('--reply', '--reply-to', '--in-reply-to', dest='reply_to', help='Tweet ID to reply to')
    parser.add_argument('--search', dest='search_query', nargs='*', help='Search query')
    parser.add_argument('--mentions', action='store_true', help='Show recent mentions')
    parser.add_argument('--text', '-t', dest='text_flag', nargs='*', help='Tweet text')
    parser.add_argument('text', nargs='*', help='Tweet text (positional)')
    
    parsed = parser.parse_args()
    
    if parsed.mentions:
        mentions()
    elif parsed.search_query is not None:
        search(' '.join(parsed.search_query))
    else:
        # Combine text from --text flag and positional args
        text_parts = []
        if parsed.text_flag:
            text_parts.extend(parsed.text_flag)
        if parsed.text:
            text_parts.extend(parsed.text)
        text = ' '.join(text_parts).strip()
        
        if not text:
            print(__doc__)
            sys.exit(0)
        
        tweet(text, reply_to=parsed.reply_to)
