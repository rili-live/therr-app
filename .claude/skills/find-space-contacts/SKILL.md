---
name: find-space-contacts
description: Find business emails and websites for imported spaces by researching each business on the web. Use when enriching space contact data.
disable-model-invocation: true
user-invocable: true
allowed-tools: WebSearch, WebFetch, Bash(npx ts-node scripts/import-spaces/query-spaces*), Bash(npx ts-node scripts/import-spaces/update-space-contact*)
argument-hint: [--mode email|website|both] [--city name] [--limit n]
---

# Find Space Contacts

You are a business researcher. Your job is to find accurate business email addresses and websites for spaces in the Therr database.

## Workflow

### Step 1: Query spaces needing enrichment

Run the query script to get a batch of spaces. Pass through any arguments the user provided:

```
npx ts-node scripts/import-spaces/query-spaces $ARGUMENTS
```

Default arguments if none provided: `--mode both --limit 5`

The script outputs JSON to stdout with space details (id, name, category, address, existing websiteUrl/businessEmail). **It handles all database credentials internally — you will never see or need env vars.**

### Step 2: Research each space

For each space in the results, use `WebSearch` and `WebFetch` to find the business's:
- **Official website** (if missing)
- **Business email address** (if missing)

#### Research strategy

1. **Search** for the business by name + city + region (e.g., `"Joe's Pizza" Eugene OR`)
2. **Evaluate results** — look for the business's own domain (not Yelp, Facebook, Google Maps, etc.)
3. **Fetch the candidate website** to verify it belongs to this specific business:
   - Does the page title or content mention the business name?
   - Does the address on the site match the space's address?
   - Is this the right location (not a different branch)?
4. **Find email** — check the website for:
   - `mailto:` links
   - Contact page (`/contact`, `/about`)
   - Footer content
   - Look for a business email, not generic addresses like `noreply@` or social media accounts
5. **Assess confidence:**
   - **High**: Business name matches, address matches, email domain matches website domain
   - **Medium**: Business name matches, no address to cross-check, but website looks right
   - **Low**: Ambiguous match — skip this space

**Only proceed with high or medium confidence matches.**

#### What NOT to do
- Do not guess or fabricate email addresses
- Do not use personal email addresses found on review sites
- Do not associate a website with the wrong business location (e.g., a chain's corporate site for a local franchise, unless that's the only website)
- Do not use social media profile URLs as the website — find the actual business domain

### Step 3: Update each space

For each space where you found contact info with sufficient confidence, run the update script:

```
npx ts-node scripts/import-spaces/update-space-contact --id <space-uuid> [--email "found@email.com"] [--website "https://found-website.com"] [--source-image]
```

- Only pass `--email` if you found a business email
- Only pass `--website` if the space didn't have one and you found it
- Add `--source-image` if the space has no media and you found/confirmed a website

The script updates the database and returns a JSON result confirming what was changed.

### Step 4: Report results

After processing all spaces, give a summary:
- How many spaces were processed
- How many emails found
- How many websites found
- How many images sourced
- Any spaces you skipped and why (low confidence, couldn't find info, etc.)

## Important rules

- **Accuracy over quantity**: It's better to skip a space than to save wrong data. We will use these emails to contact businesses.
- **Verify before saving**: Always fetch the candidate website and check that it matches the business before calling the update script.
- **One business at a time**: Research each business individually. Don't batch-assume.
- **Respect rate limits**: Pause briefly between web fetches to be a good citizen.
- **No secrets**: You never need database credentials, API keys, or .env files. The scripts handle all of that.
