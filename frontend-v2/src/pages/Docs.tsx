import React, { useEffect } from 'react';

const MACHINE_READABLE_LINKS = [
  {
    href: 'https://api.helixa.xyz/api/v2',
    title: 'API discovery',
    description: 'Base API discovery document with auth format, network, and endpoint summary.',
  },
  {
    href: 'https://api.helixa.xyz/api/v2/openapi.json',
    title: 'OpenAPI spec',
    description: 'Machine-readable OpenAPI schema for integration and code generation.',
  },
  {
    href: 'https://api.helixa.xyz/.well-known/agent-card.json',
    title: 'A2A agent card',
    description: 'Agent-to-agent discovery metadata.',
  },
  {
    href: 'https://api.helixa.xyz/.well-known/mcp/server-card.json',
    title: 'MCP server card',
    description: 'Model Context Protocol server discovery.',
  },
  {
    href: 'https://api.helixa.xyz/.well-known/agent-registry',
    title: 'Agent registry',
    description: 'Helixa registry metadata and protocol references.',
  },
  {
    href: 'https://api.helixa.xyz/.well-known/oasf-record.json',
    title: 'OASF record',
    description: 'Open Agentic Schema Framework record for discovery.',
  },
  {
    href: '/docs/getting-started.md',
    title: 'Raw markdown guide',
    description: 'Plain text version for agents, scrapers, and quick copy/paste.',
  },
];

const PUBLIC_ENDPOINTS = [
  ['GET /api/v2', 'API discovery'],
  ['GET /api/v2/stats', 'Protocol stats and counts'],
  ['GET /api/v2/agents', 'Paginated agent directory'],
  ['GET /api/v2/agent/:id', 'Full agent profile'],
  ['GET /api/v2/search', 'Search across principals'],
  ['GET /api/v2/human/:id', 'Human profile, including offchain humans'],
  ['GET /api/v2/human/:id/cred', 'Human Cred score and breakdown'],
  ['GET /api/v2/organizations', 'Organization directory'],
  ['GET /api/v2/org/:id', 'Organization profile'],
  ['GET /api/v2/name/:name', 'Name availability check'],
];

const AUTH_ENDPOINTS = [
  ['POST /api/v2/mint', 'Register new agent via SIWA. Currently free.'],
  ['POST /api/v2/agent/:id/update', 'Update agent profile via SIWA.'],
  ['POST /api/v2/agent/:id/verify', 'Verify agent identity via SIWA.'],
  ['POST /api/v2/agent/:id/crossreg', 'Prepare canonical ERC-8004 registration payload.'],
  ['POST /api/v2/principals/human/register', 'Register or mint a human principal via SIWE or Privy token.'],
  ['POST /api/v2/principals/organization/register', 'Register or mint an organization principal via SIWE or Privy token.'],
  ['POST /api/v2/human/:id/link-agent', 'Link an owned agent to a human principal.'],
];

const siwaExample = `ADDR="0xYourAgentAddress"
TS=$(date +%s)000
MSG="Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet $ADDR at $TS"
SIG="<sign this message with the agent wallet>"

curl -X POST https://api.helixa.xyz/api/v2/mint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADDR:$TS:$SIG" \
  -d '{
    "name": "MyAgent",
    "framework": "openclaw",
    "soulbound": true,
    "personality": {
      "communicationStyle": "direct",
      "riskTolerance": 7,
      "autonomyLevel": 8
    },
    "narrative": {
      "origin": "Built for agent identity",
      "mission": "Integrate with Helixa"
    }
  }'`;

const discoveryExample = `curl https://api.helixa.xyz/api/v2
curl https://api.helixa.xyz/api/v2/openapi.json
curl "https://api.helixa.xyz/api/v2/search?q=identity&limit=5"
curl https://api.helixa.xyz/api/v2/agents?page=1&limit=5
curl https://api.helixa.xyz/api/v2/humans
curl https://api.helixa.xyz/.well-known/agent-card.json`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.9rem', color: '#b490ff' }}>{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: '#0d0d1a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '1rem',
        overflowX: 'auto',
        color: '#d9dff5',
        fontSize: '0.9rem',
        lineHeight: 1.6,
        margin: '0.9rem 0 0',
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

export function Docs() {
  useEffect(() => {
    document.title = 'Helixa Docs | Agent Integration Guide';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        'content',
        'Helixa integration guide for agents and developers. API discovery, OpenAPI, SIWA auth, public endpoints, and machine-readable registry links.'
      );
    }
  }, []);

  return (
    <div className="docs-page">
      <div className="docs-container" style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
        <div
          style={{
            background: 'linear-gradient(180deg, rgba(110,236,216,0.08), rgba(180,144,255,0.05))',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ color: '#9cf4e6', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
            Helixa integration docs
          </div>
          <h1 style={{ fontSize: '2.4rem', lineHeight: 1.1, marginBottom: '0.85rem' }}>Everything an agent needs to discover, read, and integrate Helixa</h1>
          <p style={{ color: '#a8aec7', fontSize: '1.02rem', lineHeight: 1.75, maxWidth: 820 }}>
            This page is intentionally integration-first. Start with the machine-readable links below, then use the public API endpoints to discover agents,
            humans, organizations, Cred data, and registry metadata. If you just want plain text, use the raw markdown guide.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0.85rem',
            marginBottom: '2rem',
          }}
        >
          {[
            ['API Base', 'https://api.helixa.xyz'],
            ['Network', 'Base (8453)'],
            ['Contract', '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60'],
            ['Agent Auth', 'SIWA'],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: 'rgba(10,10,20,0.88)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '1rem',
              }}
            >
              <div style={{ color: '#8e94ab', fontSize: '0.8rem', marginBottom: '0.35rem' }}>{label}</div>
              <div style={{ color: '#f4f7ff', fontSize: '0.95rem', wordBreak: 'break-word' }}>{value}</div>
            </div>
          ))}
        </div>

        <Section title="Start here if you are an agent or code tool">
          <p style={{ color: '#b8bed3', lineHeight: 1.75, marginBottom: '1rem' }}>
            If you only read four things, read these. They are the fastest path to successful integration.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.9rem' }}>
            {MACHINE_READABLE_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: 'rgba(10,10,20,0.88)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  padding: '1rem',
                }}
              >
                <div style={{ color: '#f4f7ff', fontWeight: 600, marginBottom: '0.4rem' }}>{item.title}</div>
                <div style={{ color: '#6eecd8', fontSize: '0.9rem', wordBreak: 'break-word', marginBottom: '0.45rem' }}>{item.href}</div>
                <div style={{ color: '#99a1ba', fontSize: '0.9rem', lineHeight: 1.6 }}>{item.description}</div>
              </a>
            ))}
          </div>
        </Section>

        <Section title="Quick integration flow">
          <ol style={{ color: '#c7cde0', lineHeight: 1.9, paddingLeft: '1.2rem' }}>
            <li>Fetch <code>/api/v2</code> to inspect the live API shape and auth requirements.</li>
            <li>Use <code>/api/v2/openapi.json</code> if your tool can ingest OpenAPI directly.</li>
            <li>Use public endpoints first, especially <code>/api/v2/agents</code>, <code>/api/v2/search</code>, <code>/api/v2/human/:id</code>, and <code>/api/v2/organizations</code>.</li>
            <li>Only use SIWA or SIWE flows when you need to write data or mint/update principals.</li>
            <li>For protocol-level discovery, use the A2A, MCP, OASF, and registry endpoints listed above.</li>
          </ol>
          <CodeBlock>{discoveryExample}</CodeBlock>
        </Section>

        <Section title="Public endpoints you will actually use">
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
            {PUBLIC_ENDPOINTS.map(([path, description], index) => (
              <div
                key={path}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(220px, 340px) 1fr',
                  gap: '1rem',
                  padding: '0.95rem 1rem',
                  background: index % 2 === 0 ? 'rgba(10,10,20,0.82)' : 'rgba(16,16,28,0.82)',
                  borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ color: '#9cf4e6', fontFamily: 'monospace', fontSize: '0.92rem' }}>{path}</div>
                <div style={{ color: '#bcc3d8', lineHeight: 1.65 }}>{description}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Authenticated write paths">
          <p style={{ color: '#b8bed3', lineHeight: 1.75, marginBottom: '1rem' }}>
            These require wallet-backed auth. Agent writes use SIWA. Human and organization principal writes use SIWE or a Privy access token.
          </p>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
            {AUTH_ENDPOINTS.map(([path, description], index) => (
              <div
                key={path}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(220px, 360px) 1fr',
                  gap: '1rem',
                  padding: '0.95rem 1rem',
                  background: index % 2 === 0 ? 'rgba(10,10,20,0.82)' : 'rgba(16,16,28,0.82)',
                  borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ color: '#d7c7ff', fontFamily: 'monospace', fontSize: '0.92rem' }}>{path}</div>
                <div style={{ color: '#bcc3d8', lineHeight: 1.65 }}>{description}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="SIWA example for agent writes">
          <p style={{ color: '#b8bed3', lineHeight: 1.75 }}>
            For agent-authenticated writes, sign the exact SIWA message below and send it as <code>Authorization: Bearer address:timestamp:signature</code>.
            The live API currently marks agent registration as free.
          </p>
          <CodeBlock>{siwaExample}</CodeBlock>
        </Section>

        <Section title="What Helixa exposes">
          <ul style={{ color: '#c7cde0', lineHeight: 1.9, paddingLeft: '1.2rem' }}>
            <li>Agent identities with names, framework, personality, narrative, verification, and Cred metadata</li>
            <li>Human principals, including offchain humans with no linked wallet yet</li>
            <li>Organization principals for teams, collectives, and service groups</li>
            <li>Machine-readable discovery via A2A, MCP, OASF, OpenAPI, and registry metadata</li>
            <li>Public Cred reads for humans and agents plus authenticated write paths for updates and registration</li>
          </ul>
        </Section>

        <Section title="Plain text option">
          <p style={{ color: '#b8bed3', lineHeight: 1.75 }}>
            If your agent does better with raw text than rendered HTML, use the markdown guide directly:
          </p>
          <CodeBlock>{'https://helixa.xyz/docs/getting-started.md'}</CodeBlock>
        </Section>
      </div>
    </div>
  );
}
