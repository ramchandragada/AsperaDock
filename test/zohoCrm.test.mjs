import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDealsSearchCriteria,
  escapeZohoCriteriaValue,
  mapDealRecord,
  mapDealRecords,
  sanitizeDealQuery,
} from '../src/zohoCrm/deals.js';
import { resolveZohoCrmDc, sanitizeZohoCrmDc } from '../src/zohoCrm/dc.js';
import { buildCrmLookupHtml } from '../src/crmLookupHtml.js';
import {
  formatDealWhatsAppMessage,
  formatDealsWhatsAppDigest,
  buildDealWhatsAppPrepPrompt,
  sanitizePreparedWhatsAppMessage,
} from '../src/zohoCrm/waDealMessage.js';

test('sanitizeDealQuery trims and caps length', () => {
  assert.equal(sanitizeDealQuery('  Acme Corp  '), 'Acme Corp');
  assert.equal(sanitizeDealQuery('x'.repeat(120)).length, 80);
});

test('buildDealsSearchCriteria searches Deal_Name and Account_Name', () => {
  const criteria = buildDealsSearchCriteria('Flexi Loan');
  assert.match(criteria, /Deal_Name:contains:Flexi Loan/);
  assert.match(criteria, /Account_Name:contains:Flexi Loan/);
  assert.equal(buildDealsSearchCriteria(''), '');
});

test('escapeZohoCriteriaValue escapes reserved characters', () => {
  assert.equal(escapeZohoCriteriaValue('a(b):c'), 'a\\(b\\)\\:c');
});

test('mapDealRecord extracts stage and builds web URL', () => {
  const deal = mapDealRecord(
    {
      id: '123',
      Deal_Name: 'Q2 Expansion',
      Stage: 'Negotiation/Review',
      Amount: 50000,
      Closing_Date: '2026-09-01',
      Account_Name: { name: 'Acme' },
      Owner: { name: 'Priya' },
      Probability: 40,
      Created_Time: '2025-11-02T10:15:30+05:30',
      State: 'Maharashtra',
      Premise: 'Premise Compliance Code 42',
    },
    { crmHost: 'https://crm.zoho.in' },
  );
  assert.equal(deal.name, 'Q2 Expansion');
  assert.equal(deal.stage, 'Negotiation/Review');
  assert.equal(deal.accountName, 'Acme');
  assert.equal(deal.ownerName, 'Priya');
  assert.equal(deal.amount, 50000);
  assert.equal(deal.state, 'Maharashtra');
  assert.equal(deal.premise, 'Premise Compliance Code 42');
  assert.ok(deal.createdTime);
  assert.match(deal.webUrl, /module=Deals/);
  assert.match(deal.webUrl, /id=123/);
});

test('mapDealRecord finds premise-like custom API names', () => {
  const deal = mapDealRecord({
    id: '9',
    Deal_Name: 'WHIXIQO',
    Stage: 'APOB Pending',
    Premise_Compliance: 'Premise Compliance Code',
    Billing_State: 'Karnataka',
  });
  assert.equal(deal.premise, 'Premise Compliance Code');
  assert.equal(deal.state, 'Karnataka');
  assert.equal(deal.stage, 'APOB Pending');
});

test('mapDealRecords filters incomplete rows', () => {
  const deals = mapDealRecords({
    data: [{ id: '1', Deal_Name: 'A', Stage: 'Closed Won' }, { Deal_Name: 'No id' }],
  });
  assert.equal(deals.length, 1);
  assert.equal(deals[0].stage, 'Closed Won');
});

test('India is the default Zoho CRM data center', () => {
  assert.equal(sanitizeZohoCrmDc(''), 'in');
  assert.equal(resolveZohoCrmDc('in').apiDomain, 'https://www.zohoapis.in');
  assert.equal(resolveZohoCrmDc('com').accountsUrl, 'https://accounts.zoho.com');
});

test('CRM lookup popup renders deal stage UI hooks', () => {
  const html = buildCrmLookupHtml(false);
  assert.match(html, /Zoho CRM Deals/);
  assert.match(html, /Open deal/);
  assert.match(html, /Copy message/);
  assert.match(html, /Copy all for WhatsApp/);
  assert.match(html, /Copy stage/);
  assert.match(html, /crmLookupApi/);
  assert.match(html, /prepareCopy/);
  assert.match(html, /Preparing…/);
  assert.match(html, /Created:/);
  assert.match(html, /State:/);
  assert.match(html, /Premise:/);
});

test('WhatsApp deal message includes name stage state', () => {
  const msg = formatDealWhatsAppMessage({
    name: 'FERNWEH',
    stage: 'Renewal Done',
    state: 'TELANGANA',
    premise: 'TS-3-CHANDRALOK',
  });
  assert.match(msg, /\*Deal update\*/);
  assert.match(msg, /\*FERNWEH\*/);
  assert.match(msg, /\*Stage:\* Renewal Done/);
  assert.match(msg, /\*State:\* TELANGANA/);
  assert.match(msg, /\*Premise:\* TS-3-CHANDRALOK/);
});

test('WhatsApp digest lists name stage state for all deals', () => {
  const msg = formatDealsWhatsAppDigest(
    [
      { name: 'FERNWEH', stage: 'Renewal Done', state: 'TELANGANA' },
      { name: 'Other', stage: 'APOB Pending', state: 'Karnataka' },
    ],
    'FERNWEH',
  );
  assert.match(msg, /\*Deal status — FERNWEH\*/);
  assert.match(msg, /_2 deals_/);
  assert.match(msg, /1\. \*FERNWEH\*/);
  assert.match(msg, /Stage: Renewal Done/);
  assert.match(msg, /State: TELANGANA/);
  assert.match(msg, /2\. \*Other\*/);
});

test('deal prep prompt keeps facts and forbids invention', () => {
  const prompt = buildDealWhatsAppPrepPrompt({
    name: 'FERNWEH',
    stage: 'Renewal Done',
    state: 'TELANGANA',
    premise: 'TS-3-CHANDRALOK',
  });
  assert.match(prompt, /FERNWEH/);
  assert.match(prompt, /Renewal Done/);
  assert.match(prompt, /Do not invent/);
  assert.match(prompt, /paste-ready/i);
});

test('sanitizePreparedWhatsAppMessage strips fences and preamble', () => {
  const fallback = formatDealWhatsAppMessage({
    name: 'A',
    stage: 'B',
  });
  assert.equal(
    sanitizePreparedWhatsAppMessage(
      '```\nHi — *A* is at stage B.\n```',
      fallback,
    ),
    'Hi — *A* is at stage B.',
  );
  assert.match(
    sanitizePreparedWhatsAppMessage(
      "Here's your message: Friendly note about the deal.",
      fallback,
    ),
    /Friendly note/,
  );
  assert.equal(sanitizePreparedWhatsAppMessage('', fallback), fallback);
});
