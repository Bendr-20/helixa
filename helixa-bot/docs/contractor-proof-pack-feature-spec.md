# Telegram Bot Feature Spec: Contractor Proof Pack

## Why This Belongs in the Bot

This is a strong Telegram-native workflow:
- it is structured, repetitive, and form-like
- users often need the docs fast
- the required inputs are simple and deterministic
- the output is a reusable document pack, not open-ended chat

It also fits the current bot architecture, which already supports guided multi-step flows for jobs and verification.

## Goal

Let an authorized user generate a clean contractor proof pack from Telegram in a few minutes.

The pack should produce:
- contractor confirmation letter
- short visa / tax support letter
- engagement summary / lightweight SOW
- optional attachment checklist

## Non-Goals

- do not generate fake employment letters
- do not fabricate payroll, salary, benefits, or employee status
- do not sign anything automatically
- do not export anything externally without user review

## Proposed User Flow

### Entry
User runs:
- `/engagement-pack`

Or says:
- `create contractor proof pack`
- `generate visa support letter`
- `make contractor confirmation letter`

### Questions the Bot Asks
1. Client legal entity name
2. Contractor legal name or entity
3. Contractor individual name, if needed for the short letter
4. Start date
5. End date
6. Effective date
7. Scope of services
8. Compensation amount
9. Payment method
10. Signer name
11. Signer title
12. Company address
13. Contact email
14. Contact phone
15. Whether to include an attachment checklist
16. Optional supporting references:
   - invoice number
   - payment receipt or tx hash
   - confirming email date or subject

### Review Step
Bot returns a preview block with:
- all captured fields
- a warning if required fields are missing
- a plain note that the package confirms contractor status, not employment

Inline buttons:
- `Generate Pack`
- `Edit Fields`
- `Cancel`

### Output Step
Bot returns:
- letter 1 in clean text or markdown
- letter 2 in clean text or markdown
- engagement summary in clean text or markdown
- optional JSON record for storage

Nice next step:
- export as `.md`
- export as `.html`
- export as `.pdf` once a renderer exists

## Suggested Commands

- `/engagement-pack` - start guided flow
- `/engagement-preview <id>` - preview saved draft
- `/engagement-export <id>` - export generated pack
- `/engagement-list` - list recent drafts
- `/engagement-cancel` - stop current draft flow

## Data Model

Suggested draft object:

```json
{
  "id": "eng_20260422_001",
  "createdAt": "2026-04-22T13:40:00Z",
  "createdBy": {
    "telegramUserId": "5629029413",
    "username": "QuigleyNFT"
  },
  "client": {
    "displayName": "Invoica",
    "legalName": "",
    "address": "",
    "email": "",
    "phone": ""
  },
  "contractor": {
    "legalNameOrEntity": "",
    "individualName": ""
  },
  "term": {
    "effectiveDate": "",
    "startDate": "",
    "endDate": ""
  },
  "scope": [
    "smart contract and security audit support",
    "technical review",
    "backend support",
    "frontend support",
    "related implementation and advisory work"
  ],
  "compensation": {
    "amount": "",
    "paymentMethod": ""
  },
  "signer": {
    "name": "",
    "title": ""
  },
  "supportingEvidence": {
    "invoiceNumber": "",
    "paymentReference": "",
    "confirmationThreadNote": ""
  },
  "status": "draft"
}
```

## Storage Recommendation

Add a new JSON store similar to `jobs.json` and `verified.json`:
- `data/engagement-packs.json`

Keep it simple for MVP:
- append generated records
- allow per-user draft state in memory
- optionally persist in-progress drafts later

## Safety and Trust Rules

Hard rules the bot should enforce:
- always label the relationship as independent contractor unless the user explicitly switches to another supported template
- never claim employment, payroll, salary, or employee benefits unless a separate employment flow exists
- never invent names, dates, amounts, or addresses
- require explicit user review before export
- include a reminder that supporting evidence should match the generated statements

## UX Notes

Telegram is best for this if the flow is tight:
- one question at a time
- prefilled defaults where possible
- inline buttons for common scope items and payment methods
- copy-ready output blocks
- optional file attachments for markdown or PDF

The wrong version would be a giant paragraph prompt. This should behave like a fast doc wizard.

## Recommended MVP

Phase 1:
- guided field collection
- markdown output for the three docs
- checklist output
- JSON draft storage

Phase 2:
- editable saved drafts
- HTML and PDF export
- reusable org profiles for signer and company details
- support for invoice + tx hash attachment metadata

## Fit With Current Bot Code

This matches the existing pattern in `jobs.js`:
- in-memory per-user state machine
- step-by-step message capture
- inline button confirmations
- JSON persistence via `store.js`

So the clean implementation path is:
1. add engagement pack store helpers to `store.js`
2. add a new `registerEngagementCommands(bot)` module
3. reuse the same state-machine pattern as job posting
4. generate output from templates, not ad hoc strings

## Recommendation

Build this.

Not as a generic AI writing feature, but as a narrow document generator for real contractor proof. That makes it useful, fast, and much harder to misuse.
